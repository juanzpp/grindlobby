import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTrustedMutation, noStoreJson } from "@/lib/security/request";
import { enforceRateLimit, RateLimitExceededError, RateLimitUnavailableError, rateLimitResponse } from "@/lib/security/rate-limit";

const uploadSchema = z.object({
  type: z.enum(["avatar", "banner"]),
}).strict();

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
    if (file.size > maxSize) return noStoreJson({ error: body.type === "avatar" ? "A imagem do avatar deve ter até 5MB." : "O banner deve ter até 10MB." }, { status: 400 });

    const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowedMimeTypes.has(file.type)) return noStoreJson({ error: "Formato inválido. Use PNG, JPG ou WEBP." }, { status: 400 });

    const bucketName = "profile-assets";
    const admin = createAdminClient();
    try {
      await admin.storage.getBucket(bucketName);
    } catch {
      await admin.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: maxSize,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      });
    }

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const objectPath = `${user.id}/${body.type}/${randomUUID()}.${extension}`;
    const content = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(bucketName).upload(objectPath, content, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) return noStoreJson({ error: "Não foi possível salvar a imagem." }, { status: 400 });

    const { data } = admin.storage.from(bucketName).getPublicUrl(objectPath);
    return noStoreJson({ url: data.publicUrl });
  } catch (error) {
    if (error instanceof RateLimitExceededError || error instanceof RateLimitUnavailableError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) return noStoreJson({ error: "Tipo ou payload inválidos." }, { status: 400 });
    return noStoreJson({ error: "Não foi possível fazer o upload." }, { status: 500 });
  }
}
