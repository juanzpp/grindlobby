"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, Info, Lock, Mail, MailCheck, UserPlus } from "lucide-react";
import GrindPortalLoading from "@/components/feedback/GrindPortalLoading";
import EnvironmentBackdrop from "@/components/lovable/EnvironmentBackdrop";
import PortalTransition, {
  TRANSITIONS,
  type TransitionFx,
} from "@/components/lovable/PortalTransition";

type LoginPhase = "idle" | "authenticating" | "transitioning" | "loading" | "completing";

const messages: Record<string, string> = {
  confirmed: "E-mail confirmado. Sua conta está pronta.",
  password_updated: "Senha atualizada. Entre novamente.",
  confirmation_failed: "O link de confirmação é inválido ou expirou.",
};

const REMEMBER_PREFERENCE_KEY = "grindlobby.rememberLogin";
const REMEMBERED_EMAIL_KEY = "grindlobby.rememberedEmail";

function LoginForm() {
  const query = useSearchParams();
  const router = useRouter();
  const timers = useRef<number[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [phase, setPhase] = useState<LoginPhase>("idle");
  const [transitionFx, setTransitionFx] = useState<TransitionFx>("portal");
  const [error, setError] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const activeTimers = timers.current;
    const remembered = window.localStorage.getItem(REMEMBER_PREFERENCE_KEY) !== "false";
    setRemember(remembered);
    if (remembered) setEmail(window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "");
    return () => activeTimers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  function wait(ms: number) {
    return new Promise<void>((resolve) => timers.current.push(window.setTimeout(resolve, ms)));
  }

  async function completeLogin() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase("transitioning");
    await wait(reducedMotion ? 30 : 2200);
    setPhase("loading");
    try {
      await fetch("/api/me", { cache: "no-store" });
    } catch {
      // The destination validates the session again.
    }
    setPhase("completing");
    await wait(reducedMotion ? 20 : 220);
    router.prefetch("/");
    router.replace("/");
    router.refresh();
  }

  function persistRememberPreference() {
    window.localStorage.setItem(REMEMBER_PREFERENCE_KEY, String(remember));
    if (remember) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
    else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase !== "idle") return;
    setPhase("authenticating");
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: email, password, remember }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPhase("idle");
        if (data.code === "email_unconfirmed") {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        } else {
          setError(data.error || "Não foi possível entrar.");
        }
        return;
      }
      persistRememberPreference();
      window.sessionStorage.setItem("grindlobby.portalTransition", "active");
      void completeLogin();
    } catch {
      setPhase("idle");
      setError("Sem conexão. Verifique sua rede e tente novamente.");
    }
  }

  async function resendConfirmation() {
    if (resending) return;
    if (!email.trim()) {
      setError("Informe seu e-mail para reenviar a confirmação.");
      return;
    }
    setResending(true);
    setError("");
    setConfirmationMessage("");
    try {
      const response = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) throw new Error();
      setConfirmationMessage("Se a conta estiver pendente, enviaremos uma nova mensagem.");
    } catch {
      setError("Não foi possível reenviar a confirmação agora.");
    } finally {
      setResending(false);
    }
  }

  const disabled = phase !== "idle";
  const entering = phase === "transitioning";
  const statusMessage = messages[query.get("status") || ""];

  return (
    <main className="lovable-login relative min-h-screen overflow-hidden bg-background">
      <EnvironmentBackdrop focusX={28} />
      <div
        className={`relative grid min-h-screen grid-cols-1 items-center gap-8 px-5 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:px-14 ${
          entering ? "animate-push-in origin-[28%_50%]" : ""
        }`}
      >
        <section className="relative flex flex-col items-center">
          <div className="relative w-full max-w-[620px]">
            <div className="pointer-events-none absolute inset-0 rounded-full opacity-70 blur-3xl [background:var(--gl-gradient-hero)]" />
            <Image
              src="/lovable/login-portal.jpg"
              alt="Portal monumental da GrindLobby com feixe de luz roxa"
              width={1280}
              height={1280}
              priority
              sizes="(max-width: 1023px) 100vw, 58vw"
              className="relative mx-auto h-auto w-full opacity-90 mix-blend-screen [mask-image:radial-gradient(66%_66%_at_50%_46%,black,transparent)]"
            />
            <div
              className={`pointer-events-none absolute bottom-[14%] left-1/2 h-[2px] w-[2px] -translate-x-1/2 rounded-full bg-primary-glow ${
                entering ? "animate-portal-surge" : ""
              }`}
            />
          </div>

          <h1 className="font-display text-4xl tracking-[0.34em] text-foreground sm:text-6xl">GRINDLOBBY</h1>
          <div className="my-5 flex items-center gap-3 text-primary-glow" aria-hidden="true">
            <span className="h-px w-24 bg-border sm:w-40" />
            <span className="rotate-45 text-xs">◆</span>
            <span className="h-px w-24 bg-border sm:w-40" />
          </div>
          <p className="lovable-label !text-base !tracking-[0.28em] !text-primary-glow">Seu caminho. Sua lenda.</p>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Compita. Evolua. Conquiste.
            <br />
            O próximo nível começa aqui.
          </p>

          <div className="mt-8 flex flex-col items-center gap-2">
            <span className="lovable-label">Efeito de entrada</span>
            <div className="flex flex-wrap justify-center gap-2">
              {TRANSITIONS.map((transition) => (
                <button
                  key={transition.id}
                  type="button"
                  title={transition.hint}
                  aria-pressed={transitionFx === transition.id}
                  onClick={() => setTransitionFx(transition.id)}
                  disabled={disabled}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all hover:scale-[1.04] disabled:pointer-events-none disabled:opacity-60 ${
                    transitionFx === transition.id
                      ? "border-primary/60 bg-primary/20 text-primary-glow shadow-[var(--gl-shadow-glow)]"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {transition.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="lovable-panel relative z-10 w-full max-w-[520px] justify-self-center bg-card p-7 sm:p-9">
          <header className="flex flex-col items-center text-center">
            <Image
              src="/brand/ascent-portal.png"
              alt="Símbolo Ascent Portal da GrindLobby"
              width={1312}
              height={1199}
              sizes="96px"
              className="h-24 w-24 object-contain drop-shadow-[0_0_22px_rgba(139,92,246,0.42)]"
            />
            <p className="mt-2 font-display text-2xl tracking-[0.32em] text-foreground">GRINDLOBBY</p>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Entre. Foque. Supere.
              <br />
              O topo espera por você.
            </p>
          </header>

          <form className="mt-7 space-y-5" onSubmit={submit}>
            {statusMessage ? <div className="lovable-feedback lovable-feedback-success" role="status">{statusMessage}</div> : null}
            <label className="block" htmlFor="email">
              <span className="lovable-label">E-mail</span>
              <span className="mt-2 flex items-center gap-3 rounded-lg border border-input bg-secondary px-3 focus-within:border-primary/75 focus-within:shadow-[0_0_0_3px_oklch(var(--gl-primary)/.12)]">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  disabled={disabled}
                  required
                  className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </span>
            </label>

            <label className="block" htmlFor="password">
              <span className="lovable-label">Senha</span>
              <span className="mt-2 flex items-center gap-3 rounded-lg border border-input bg-secondary px-3 focus-within:border-primary/75 focus-within:shadow-[0_0_0_3px_oklch(var(--gl-primary)/.12)]">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  disabled={disabled}
                  required
                  className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={disabled}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <LoginToggle checked={remember} onChange={() => setRemember((value) => !value)} label="Lembrar senha" disabled={disabled} />
            </div>

            {error ? <div className="lovable-feedback lovable-feedback-error" role="alert">{error}</div> : null}
            {confirmationMessage ? <div className="lovable-feedback lovable-feedback-success" role="status">{confirmationMessage}</div> : null}

            <button type="submit" className="lovable-btn-primary flex h-14 w-full items-center justify-center gap-3 rounded-xl text-base font-semibold" disabled={disabled}>
              {phase === "authenticating" ? "Autenticando sessão" : entering ? "Abrindo portal..." : "Entrar"}
              <ArrowRight className="h-5 w-5" />
            </button>
            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-primary-glow underline underline-offset-4">Esqueci minha senha</Link>
            </div>
          </form>

          <div className="mt-7 border-t border-border pt-6">
            <div className="flex flex-wrap items-center gap-3 rounded-xl">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-primary-glow"><MailCheck className="h-5 w-5" /></div>
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-semibold text-foreground">Confirmação por e-mail obrigatória</p>
                <p className="text-xs text-muted-foreground">Verifique sua caixa de entrada para ativar sua conta.</p>
              </div>
              <button type="button" onClick={resendConfirmation} disabled={resending || disabled} className="lovable-btn-ghost rounded-lg px-4 py-2.5 text-sm !text-primary-glow">
                {resending ? "Reenviando…" : "Reenviar confirmação"}
              </button>
            </div>
          </div>

          <footer>
            <div className="mt-7 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              Ainda não tem uma conta?
              <Link href="/register" className="inline-flex items-center gap-2 font-semibold text-primary-glow">Criar conta <UserPlus className="h-4 w-4" /></Link>
            </div>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Seus dados estão protegidos com segurança de nível competitivo.
            </p>
            <p className="mt-4 text-center text-xs text-muted-foreground"><Link href="/" className="underline underline-offset-4">Ir para o dashboard</Link></p>
          </footer>
        </section>
      </div>

      {entering ? <PortalTransition variant={transitionFx} /> : null}
      {phase === "loading" || phase === "completing" ? (
        <GrindPortalLoading
          variant="fullscreen"
          label="Sincronizando perfil"
          complete={phase === "completing"}
          effect={transitionFx}
        />
      ) : null}
    </main>
  );
}

function LoginToggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled: boolean }) {
  return (
    <button type="button" onClick={onChange} disabled={disabled} className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-60">
      <span className={`grid h-5 w-5 place-items-center rounded-[5px] border text-[11px] font-bold ${checked ? "border-transparent bg-primary text-white" : "border-border bg-secondary"}`}>{checked ? "✓" : ""}</span>
      <span className="text-sm text-foreground">{label}</span>
      <Info className="h-3.5 w-3.5" />
    </button>
  );
}

export default function Login() {
  return <Suspense fallback={<GrindPortalLoading variant="fullscreen" label="Autenticando sessão" />}><LoginForm /></Suspense>;
}
