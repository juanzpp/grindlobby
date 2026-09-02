import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, LogOut } from "lucide-react";
import { callSession } from "@/lib/call-session";
import { supabase } from "@/lib/supabase";

type LogoutButtonProps = {
  className?: string;
  onError?: (message: string) => void;
};

export function LogoutButton({ className = "", onError }: LogoutButtonProps) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    if (signingOut) return;

    setSigningOut(true);
    onError?.("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("profiles")
          .update({ status: "offline", last_seen_at: new Date().toISOString() })
          .eq("id", user.id);
      }

      try {
        const { livekitSession } = await import("@/lib/livekit-session");
        await livekitSession.disconnect(true);
      } catch (disconnectError) {
        console.error("[auth] failed to disconnect active call", disconnectError);
        callSession.leave();
      }

      await supabase.removeAllChannels();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;

      await navigate({ to: "/login", replace: true });
    } catch (logoutError) {
      const message =
        logoutError instanceof Error
          ? logoutError.message
          : "Não foi possível sair da conta. Tente novamente.";
      onError?.(message);
      setSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={signingOut}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      {signingOut ? "Saindo..." : "Sair da conta"}
    </button>
  );
}
