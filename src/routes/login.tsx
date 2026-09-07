import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";

import portal from "@/assets/login-portal.jpg";
import { PortalTransition } from "@/components/PortalTransition";
import { setAuthPersistence, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — GrindLobby" },
      {
        name: "description",
        content: "Acesse sua conta GrindLobby e entre na comunidade.",
      },
    ],
  }),
  component: LoginPage,
});

type AuthMode = "login" | "register" | "recovery";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [entering, setEntering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) {
        void navigate({ to: "/loading", replace: true });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setPassword("");
        setAuthError(null);
        setAuthSuccess("Defina sua nova senha para concluir a recuperação.");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  const openLobby = () => {
    setEntering(true);
    window.setTimeout(() => {
      void navigate({ to: "/loading", replace: true });
    }, 1200);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || entering) return;

    const normalizedEmail = email.trim();
    setAuthError(null);
    setAuthSuccess(null);

    if (mode !== "recovery" && !normalizedEmail) {
      setAuthError("Informe seu e-mail.");
      return;
    }
    if (!password) {
      setAuthError(mode === "recovery" ? "Informe a nova senha." : "Informe sua senha.");
      return;
    }
    if ((mode === "register" || mode === "recovery") && password.length < 8) {
      setAuthError("Use uma senha com pelo menos 8 caracteres.");
      return;
    }

    setSubmitting(true);
    setAuthPersistence(remember);

    if (mode === "recovery") {
      const { error } = await supabase.auth.updateUser({ password });
      setSubmitting(false);
      if (error) {
        setAuthError("Não foi possível atualizar sua senha. Solicite um novo link.");
        return;
      }
      setAuthSuccess("Senha atualizada. Entrando no GrindLobby...");
      openLobby();
      return;
    }

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });
      setSubmitting(false);
      if (error) {
        setAuthError(error.message.toLowerCase().includes("already") ? "Este e-mail já está cadastrado." : "Não foi possível criar a conta agora.");
        return;
      }
      if (data.session) {
        openLobby();
      } else {
        setAuthSuccess("Conta criada. Verifique seu e-mail para concluir o acesso.");
        setMode("login");
        setPassword("");
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setSubmitting(false);

    if (error) {
      const lower = error.message.toLowerCase();
      setAuthError(
        lower.includes("invalid login credentials")
          ? "E-mail ou senha inválidos."
          : lower.includes("email not confirmed")
            ? "Confirme seu e-mail antes de entrar."
            : "Não foi possível entrar agora. Tente novamente.",
      );
      return;
    }

    openLobby();
  };

  const requestRecovery = async () => {
    const normalizedEmail = email.trim();
    setAuthError(null);
    setAuthSuccess(null);
    if (!normalizedEmail) {
      setAuthError("Digite seu e-mail primeiro para recuperar a senha.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${location.origin}/login`,
    });
    setSubmitting(false);
    if (error) {
      setAuthError("Não foi possível enviar o link de recuperação agora.");
      return;
    }
    setAuthSuccess("Link de recuperação enviado para seu e-mail.");
  };

  const socialLogin = async (provider: "google" | "discord") => {
    setAuthError(null);
    setAuthSuccess(null);
    setAuthPersistence(remember);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/loading` },
    });
    if (error) setAuthError(`Não foi possível iniciar o login com ${provider === "google" ? "Google" : "Discord"}.`);
  };

  const changeMode = (next: AuthMode) => {
    if (submitting || entering) return;
    setMode(next);
    setPassword("");
    setAuthError(null);
    setAuthSuccess(null);
  };

  return (
    <main className="gl-login-page">
      <div className="gl-login-bg" style={{ backgroundImage: `url(${portal})` }} />

      <div className="gl-login-brand">
        <img src="/grindlobby-logo.png" alt="GrindLobby" />
        <div>
          <div className="gl-login-brand-name">GrindLobby</div>
          <div className="gl-login-brand-tag">Jogue. Conecte. Evolua.</div>
        </div>
      </div>

      <div className="gl-login-welcome">
        Bem-vindo(a) de volta
        <strong>GrindLobby</strong>
      </div>

      <section className="gl-login-copy" aria-label="GrindLobby">
        <h1>
          Mais que<br />
          jogos, uma<br />
          comunidade<br />
          que <em>joga junto.</em>
        </h1>
        <p>Encontre teammates, suba de elo, participe de comunidades e viva o seu próximo capítulo no GrindLobby.</p>
        <div className="gl-login-divider" />
        <div className="gl-login-benefits">
          <div className="gl-login-benefit"><Users /> <span>Jogue com pessoas reais</span></div>
          <div className="gl-login-benefit"><ShieldCheck /> <span>Evolua no seu ritmo</span></div>
          <div className="gl-login-benefit"><Users /> <span>Comunidades ativas</span></div>
          <div className="gl-login-benefit"><BarChart3 /> <span>Seu progresso importa</span></div>
        </div>
      </section>

      <div className="gl-login-mantra">Mesmos jogos.<br />Pessoas melhores.</div>
      <div className="gl-login-quote">— &nbsp; Disciplina hoje. Lendas amanhã. &nbsp; —</div>

      <section className="gl-login-card" aria-label="Autenticação">
        <div className="gl-login-card-logo">
          <img src="/grindlobby-logo.png" alt="" />
          <strong>GrindLobby</strong>
          <span>Jogue. Conecte. Evolua.</span>
        </div>

        {mode !== "recovery" && (
          <div className="gl-auth-tabs" role="tablist" aria-label="Entrar ou criar conta">
            <button type="button" role="tab" aria-selected={mode === "login"} className={`gl-auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => changeMode("login")}>Entrar</button>
            <button type="button" role="tab" aria-selected={mode === "register"} className={`gl-auth-tab ${mode === "register" ? "active" : ""}`} onClick={() => changeMode("register")}>Criar conta</button>
          </div>
        )}

        <form className="gl-auth-form" onSubmit={submit}>
          {mode !== "recovery" && (
            <label className="gl-auth-field">
              <Mail />
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="Seu e-mail" disabled={submitting || entering} aria-label="E-mail" />
            </label>
          )}

          <label className="gl-auth-field">
            <Lock />
            <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder={mode === "recovery" ? "Nova senha" : "Sua senha"} disabled={submitting || entering} aria-label={mode === "recovery" ? "Nova senha" : "Senha"} />
            <button type="button" onClick={() => setShowPassword((value) => !value)} disabled={submitting || entering} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff /> : <Eye />}</button>
          </label>

          {mode === "login" && (
            <div className="gl-auth-options">
              <button className="gl-auth-remember" type="button" onClick={() => setRemember((value) => !value)} disabled={submitting || entering}>
                <span className={`gl-auth-check ${remember ? "active" : ""}`}>{remember ? "✓" : ""}</span>
                <span>Lembrar senha</span>
              </button>
              <button className="gl-auth-link" type="button" onClick={() => void requestRecovery()} disabled={submitting || entering}>Esqueceu sua senha?</button>
            </div>
          )}

          {mode === "register" && (
            <div className="gl-auth-options">
              <button className="gl-auth-remember" type="button" onClick={() => setRemember((value) => !value)} disabled={submitting || entering}>
                <span className={`gl-auth-check ${remember ? "active" : ""}`}>{remember ? "✓" : ""}</span>
                <span>Manter conectado</span>
              </button>
            </div>
          )}

          {authError && <div className="gl-auth-error" role="alert">{authError}</div>}
          {authSuccess && <div className="gl-auth-success" role="status">{authSuccess}</div>}

          <button className="gl-auth-submit" type="submit" disabled={submitting || entering}>
            {submitting ? "Processando..." : entering ? "Abrindo Lobby..." : mode === "register" ? "Criar minha conta" : mode === "recovery" ? "Salvar nova senha" : "Entrar no Lobby"}
            <ArrowRight size={18} />
          </button>

          {mode === "recovery" && <button className="gl-auth-link" type="button" onClick={() => changeMode("login")}>Voltar para o login</button>}
        </form>

        {mode === "login" && (
          <>
            <div className="gl-auth-separator">ou entre com</div>
            <div className="gl-social-row">
              <button className="gl-social-button" type="button" disabled title="Steam requer integração própria de OpenID"><span className="gl-social-glyph steam">S</span></button>
              <button className="gl-social-button" type="button" onClick={() => void socialLogin("discord")} title="Entrar com Discord"><span className="gl-social-glyph discord">D</span></button>
              <button className="gl-social-button" type="button" onClick={() => void socialLogin("google")} title="Entrar com Google"><span className="gl-social-glyph google">G</span></button>
              <button className="gl-social-button" type="button" disabled title="Xbox requer provedor Microsoft configurado"><span className="gl-social-glyph xbox">X</span></button>
            </div>
          </>
        )}

        <div className="gl-auth-bottom">
          {mode === "login" ? (
            <>Novo por aqui?<button type="button" onClick={() => changeMode("register")}>Criar uma conta</button></>
          ) : mode === "register" ? (
            <>Já possui conta?<button type="button" onClick={() => changeMode("login")}>Entrar</button></>
          ) : null}
        </div>
      </section>

      <div className="gl-login-version">GrindLobby v1.0.0</div>
      {entering && <PortalTransition variant="portal" />}
    </main>
  );
}
