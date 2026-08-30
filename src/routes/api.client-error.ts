import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export const Route = createFileRoute("/api/client-error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const contentType = request.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return json({ ok: false }, 415);
        const body = (await request.json().catch(() => null)) as
          | { message?: unknown; stack?: unknown; route?: unknown; userAgent?: unknown }
          | null;
        const message = typeof body?.message === "string" ? body.message.slice(0, 2000) : "Unknown client error";
        const stack = typeof body?.stack === "string" ? body.stack.slice(0, 8000) : "";
        const route = typeof body?.route === "string" ? body.route.slice(0, 500) : "";
        const userAgent = typeof body?.userAgent === "string" ? body.userAgent.slice(0, 1000) : "";
        console.error("[client-error]", { message, route, userAgent, stack });
        return json({ ok: true });
      },
    },
  },
});
