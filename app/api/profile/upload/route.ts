import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTrustedMutation, noStoreJson } from "@/lib/security/request";
import { enforceRateLimit, RateLimitExceededError, RateLimitUnavailableError, rateLimitResponse } from "@/lib/security/rate-limit";

const uploadSchema = z.object({
  type: z.enum(["avatar", "banner"]),
}).strict();

function hasValidImageSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (mime === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/webp") {
    return bytes.length >= 12
      && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await getCurrentUser();
    if (!user) return noStoreJson({ error: "Não autorizado." }, { status: 401 });
    await enforceRateLimit(request, { scope: "profile-upload", limit: 20, windowSeconds: 600, subject: user.id });

    const formData = await request.formData();
    const rawType = formData.get("type");
    const file = formData.get("file");
    const body = uploadSchema.parse({ type: String(rawType ?? "") });

    if (!(file instanceof File)) return noStoreJson({ error: "Imagem não enviada." }, { status: 400 });

    const maxSize = body.type === "avatar" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxSize) return noStoreJson({ error: body.type === "avatar" ? "A imagem do avatar deve ter até 5MB." : "O banner deve ter até 10MB." }, { status: 400 });

    const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowedMimeTypes.has(file.type)) return noStoreJson({ error: "Formato inválido. Use PNG, JPG ou WEBP." }, { status: 400 });

    const content = new Uint8Array(await file.arrayBuffer());
    if (!hasValidImageSignature(content, file.type)) {
      return noStoreJson({ error: "O arquivo enviado não corresponde a uma imagem válida." }, { status: 400 });
    }

    const bucketName = "profile-assets";
    const admin = createAdminClient();
    const { data: bucketData, error: bucketError } = await admin.storage.getBucket(bucketName);
    if (bucketError) {
      const { error: createBucketError } = await admin.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      });
      if (createBucketError && !/already exists/i.test(createBucketError.message)) {
        return noStoreJson({ error: "Não foi possível preparar o armazenamento de perfil." }, { status: 500 });
      }
    } else if (bucketData && !bucketData.public) {
      const { error: updateBucketError } = await admin.storage.updateBucket(bucketName, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      });
      if (updateBucketError) return noStoreJson({ error: "Não foi possível liberar a visualização da imagem de perfil." }, { status: 500 });
    }

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const objectPath = `${user.id}/${body.type}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage.from(bucketName).upload(objectPath, content, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) return noStoreJson({ error: "Não foi possível salvar a imagem." }, { status: 400 });

    const { data } = admin.storage.from(bucketName).getPublicUrl(objectPath);
    const publicUrl = data.publicUrl;
    const column = body.type === "avatar" ? "avatar" : "profile_banner";
    const { data: previousProfile } = await admin
      .from("profiles")
      .select("avatar,profile_banner")
      .eq("id", user.id)
      .maybeSingle();

    const previousUrl = body.type === "avatar" ? previousProfile?.avatar : previousProfile?.profile_banner;
    const { error: persistError } = await admin
      .from("profiles")
      .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (persistError) {
      await admin.storage.from(bucketName).remove([objectPath]);
      return noStoreJson({ error: "A imagem foi enviada, mas não foi possível aplicá-la ao perfil." }, { status: 500 });
    }

    if (typeof previousUrl === "string" && previousUrl.includes(`/storage/v1/object/public/${bucketName}/`)) {
      try {
        const previousPath = decodeURIComponent(previousUrl.split(`/storage/v1/object/public/${bucketName}/`)[1]?.split("?")[0] ?? "");
        if (previousPath && previousPath !== objectPath && previousPath.startsWith(`${user.id}/`)) {
          await admin.storage.from(bucketName).remove([previousPath]);
        }
      } catch {
        // Cleanup is best-effort and must not break a successful upload.
      }
    }

    return noStoreJson({ url: publicUrl, applied: true });
  } catch (error) {
    if (error instanceof RateLimitExceededError || error instanceof RateLimitUnavailableError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) return noStoreJson({ error: "Tipo ou payload inválidos." }, { status: 400 });
    return noStoreJson({ error: "Não foi possível fazer o upload." }, { status: 500 });
  }
}
