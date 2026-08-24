import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  Lock,
  Mail,
  MailCheck,
  UserPlus,
} from "lucide-react";

import portal from "@/assets/login-portal.jpg";
import { EnvironmentBackdrop } from "@/components/EnvironmentBackdrop";
import {
  PortalTransition,
  TRANSITIONS,
  type TransitionFx,
} from "@/components/PortalTransition";


export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — GrindLobby" },
      {
        name: "description",
        content:
          "Acesse sua conta GrindLobby: compita, evolua e conquiste seu lugar no topo do ranking competitivo.",
      },
      { property: "og:title", content: "Entrar — GrindLobby" },
      {
        property: "og:description",
        content: "Entre. Foque. Supere. O topo espera por você.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [rememberEca, setRememberEca] = useState(true);
  const [entering, setEntering] = useState(false);
  const [fx, setFx] = useState<TransitionFx>("portal");

  const handleEnter = (event: React.FormEvent) => {
    event.preventDefault();
    if (entering) return;
    setEntering(true);
    window.setTimeout(() => navigate({ to: "/loading" }), 2200);
  };


  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <EnvironmentBackdrop focusX={28} />
      <div
        className={`grid min-h-screen grid-cols-1 items-center gap-8 px-5 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:px-14 ${
          entering ? "animate-push-in origin-[28%_50%]" : ""
        }`}
      >

        {/* Hero / portal */}
        <section className="relative flex flex-col items-center">
          <div className="relative w-full max-w-[620px]">
            <div className="pointer-events-none absolute inset-0 rounded-full opacity-70 blur-3xl [background:var(--gradient-hero)]" />
            <img
              src={portal}
              alt="Portal monumental da GrindLobby com feixe de luz roxa"
              width={1280}
              height={1280}
              className="relative mx-auto w-full opacity-90 mix-blend-screen [mask-image:radial-gradient(66%_66%_at_50%_46%,black,transparent)]"
            />
            <div
              className={`pointer-events-none absolute left-1/2 bottom-[14%] h-[2px] w-[2px] -translate-x-1/2 rounded-full bg-primary-glow ${
                entering ? "animate-portal-surge" : ""
              }`}
            />
          </div>

          <h1 className="font-display text-4xl tracking-[0.34em] text-foreground sm:text-6xl">
            GRINDLOBBY
          </h1>
          <div className="my-5 flex items-center gap-3 text-primary-glow">
            <span className="h-px w-24 bg-border sm:w-40" />
            <span className="rotate-45 text-xs">◆</span>
            <span className="h-px w-24 bg-border sm:w-40" />
          </div>
          <p className="label-caps !text-base !tracking-[0.28em] !text-primary-glow">
            Seu caminho. Sua lenda.
          </p>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Compita. Evolua. Conquiste.
            <br />
            O próximo nível começa aqui.
          </p>

          <div className="mt-8 flex flex-col items-center gap-2">
            <span className="label-caps">Efeito de entrada</span>
            <div className="flex flex-wrap justify-center gap-2">
              {TRANSITIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.hint}
                  onClick={() => setFx(t.id)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all hover:scale-[1.04] ${
                    fx === t.id
                      ? "border-primary/60 bg-primary/20 text-primary-glow shadow-[var(--shadow-glow)]"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </section>


        {/* Login card */}
        <section className="panel relative z-10 w-full max-w-[520px] justify-self-center bg-card p-7 sm:p-9">
          <div className="flex flex-col items-center">
            <img
              src={portal}
              alt=""
              width={1280}
              height={1280}
              loading="lazy"
              className="h-24 w-24 object-cover object-top [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]"
            />
            <p className="mt-2 font-display text-2xl tracking-[0.32em] text-foreground">
              GRINDLOBBY
            </p>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Entre. Foque. Supere.
              <br />
              O topo espera por você.
            </p>
          </div>

          <form className="mt-7 space-y-5" onSubmit={handleEnter}>
            <div>
              <label className="label-caps" htmlFor="email">
                E-mail
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-input bg-secondary px-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div>
              <label className="label-caps" htmlFor="password">
                Senha
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-input bg-secondary px-3">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <Toggle
                checked={remember}
                onChange={() => setRemember((v) => !v)}
                label="Lembrar senha"
              />
              <Toggle
                checked={rememberEca}
                onChange={() => setRememberEca((v) => !v)}
                label="Lembrar ECA digital"
              />
            </div>




            <button
              type="submit"
              className="btn-primary flex h-14 w-full items-center justify-center gap-3 rounded-xl text-base font-semibold"
            >
              {entering ? "Abrindo portal..." : "Entrar"}
              <ArrowRight className="h-5 w-5" />
            </button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-primary-glow underline underline-offset-4"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>

          <div className="mt-7 border-t border-border pt-6">
            <div className="flex flex-wrap items-center gap-3 rounded-xl">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-primary-glow">
                <MailCheck className="h-5 w-5" />
              </div>
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Confirmação por e-mail obrigatória
                </p>
                <p className="text-xs text-muted-foreground">
                  Verifique sua caixa de entrada para ativar sua conta.
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost rounded-lg px-4 py-2.5 text-sm text-primary-glow"
              >
                Reenviar confirmação
              </button>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            Ainda não tem uma conta?
            <span className="inline-flex items-center gap-2 font-semibold text-primary-glow">
              Criar conta <UserPlus className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Seus dados estão protegidos com segurança de nível competitivo.
          </p>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/" className="underline underline-offset-4">
              Ir para o dashboard
            </Link>
          </p>
        </section>
      </div>

      {/* Transição cinematográfica até o portal */}
      {entering && <PortalTransition variant={fx} />}

    </main>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
    >
      <span
        className={`grid h-5 w-5 place-items-center rounded-[5px] border text-[11px] font-bold ${
          checked
            ? "border-transparent bg-primary text-primary-foreground"
            : "border-border bg-secondary"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      <span className="text-sm text-foreground">{label}</span>
      <Info className="h-3.5 w-3.5" />
    </button>
  );
}
