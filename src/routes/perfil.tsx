import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  Coins,
  Image as ImageIcon,
  Lock,
  Palette,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  User,
} from "lucide-react";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import { fileToDataUrl } from "@/lib/image-upload";
import { getTier } from "@/lib/levels";
import { PlayerProvider, findItem, usePlayer, type PlayerProfile } from "@/lib/player-store";
import { STORE_ITEMS } from "@/lib/store-items";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Editar perfil — GrindLobby" },
      {
        name: "description",
        content:
          "Personalize sua foto de perfil, banner, moldura, título e cor de destaque no GrindLobby.",
      },
      { property: "og:title", content: "Editar perfil — GrindLobby" },
      {
        property: "og:description",
        content: "Foto, banner, molduras e títulos: monte a identidade do seu perfil competitivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerfilPage,
});

const TABS = [
  { id: "conta", label: "Minha conta", icon: User },
  { id: "aparencia", label: "Aparência", icon: Camera },
  { id: "itens", label: "Itens equipáveis", icon: Sparkles },
  { id: "privacidade", label: "Privacidade", icon: Shield },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ACCENTS = [
  "oklch(0.58 0.24 300)",
  "oklch(0.62 0.2 250)",
  "oklch(0.68 0.17 160)",
  "oklch(0.74 0.15 88)",
  "oklch(0.6 0.22 20)",
  "oklch(0.66 0.18 340)",
];

const STATUSES: { id: PlayerProfile["status"]; label: string; dot: string }[] = [
  { id: "online", label: "Online", dot: "oklch(0.72 0.17 150)" },
  { id: "ausente", label: "Ausente", dot: "oklch(0.8 0.15 90)" },
  { id: "ocupado", label: "Ocupado", dot: "oklch(0.62 0.22 20)" },
  { id: "invisivel", label: "Invisível", dot: "oklch(0.55 0.02 285)" },
];

function PerfilPage() {
  return (
    <PlayerProvider>
      <PerfilInner />
    </PlayerProvider>
  );
}

function PerfilInner() {
  const { player, update, equip, reset } = usePlayer();
  const [tab, setTab] = useState<TabId>("conta");
  const [form, setForm] = useState(player);
  const [toast, setToast] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const tier = getTier(player.level);
  const equippedBanner = findItem(player.equipped.banner);
  const title = findItem(player.equipped.title)?.label;
  const dirty = JSON.stringify(form) !== JSON.stringify(player);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function pickImage(kind: "avatar" | "banner", file?: File | null) {
    if (!file) return;
    try {
      const url =
        kind === "avatar"
          ? await fileToDataUrl(file, 320, 320)
          : await fileToDataUrl(file, 1200, 400);
      const patch = kind === "avatar" ? { avatarUrl: url } : { bannerUrl: url };
      setForm((f) => ({ ...f, ...patch }));
      update(patch);
      flash(kind === "avatar" ? "Foto de perfil atualizada" : "Banner atualizado");
    } catch {
      flash("Não foi possível carregar essa imagem");
    }
  }

  function save() {
    update({
      nickname: form.nickname.trim() || "jogador",
      handle: form.handle.trim().replace(/^@/, "") || "jogador",
      bio: form.bio,
      status: form.status,
      region: form.region,
      game: form.game,
      accent: form.accent,
      privateProfile: form.privateProfile,
      allowInvites: form.allowInvites,
    });
    flash("Perfil salvo");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <input
        ref={avatarInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pickImage("avatar", e.target.files?.[0])}
      />
      <input
        ref={bannerInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pickImage("banner", e.target.files?.[0])}
      />

      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md md:px-8">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <h1 className="font-display text-lg font-bold">Editar perfil</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-2 text-xs font-semibold">
            <Coins className="h-3.5 w-3.5 text-primary-glow" /> {player.coins}
          </span>
          <Link
            to="/loja"
            className="btn-ghost rounded-lg px-3 py-2 text-xs font-semibold"
          >
            Ir para a loja
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-4 md:p-8 lg:grid-cols-[240px_1fr]">
        {/* Tabs laterais */}
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                tab === id
                  ? "border border-primary/40 bg-primary/15 text-foreground shadow-[0_0_20px_oklch(0.58_0.24_300/0.25)]"
                  : "border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-5">
          {/* Preview ao vivo */}
          <section className="panel overflow-hidden">
            <div
              className="relative h-36 md:h-44"
              style={{
                backgroundImage: form.bannerUrl
                  ? `url(${form.bannerUrl})`
                  : equippedBanner?.gradient,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
              <div className="absolute right-3 top-3 flex gap-2">
                <button
                  onClick={() => bannerInput.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background/70 px-2.5 py-1.5 text-[11px] font-semibold backdrop-blur transition-colors hover:border-primary/50"
                >
                  <ImageIcon className="h-3.5 w-3.5" /> Trocar banner
                </button>
                {form.bannerUrl && (
                  <button
                    onClick={() => {
                      setForm((f) => ({ ...f, bannerUrl: "" }));
                      update({ bannerUrl: "" });
                    }}
                    aria-label="Remover banner"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/70 backdrop-blur"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4 px-5 pb-5">
              <div className="-mt-12 flex flex-col items-center gap-2">
                <button
                  onClick={() => avatarInput.current?.click()}
                  className="group relative rounded-full"
                  aria-label="Trocar foto de perfil"
                >
                  <ProfileAvatar
                    name={form.nickname}
                    size={92}
                    borderId={player.equipped.border}
                    avatarUrl={form.avatarUrl}
                  />
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="h-5 w-5" />
                  </span>
                </button>
                <button
                  onClick={() => avatarInput.current?.click()}
                  className="flex items-center gap-1 text-[11px] font-semibold text-primary-glow"
                >
                  <Upload className="h-3 w-3" /> Enviar foto
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-display text-xl font-bold">
                  {form.nickname}
                  {title && (
                    <span
                      className="rounded border px-1.5 text-[10px] font-bold"
                      style={{
                        borderColor: form.accent,
                        color: form.accent,
                        background: "oklch(0.2 0.05 300 / 0.4)",
                      }}
                    >
                      {title}
                    </span>
                  )}
                  <BadgeCheck className="h-4 w-4" style={{ color: form.accent }} />
                </p>
                <p className="text-xs text-muted-foreground">@{form.handle}</p>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                  {form.bio || "Sem bio ainda."}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className="rounded-md border px-2 py-1 font-semibold"
                    style={{ borderColor: `${tier.color}`, color: tier.color }}
                  >
                    Level {player.level} • {tier.name}
                  </span>
                  <span className="rounded-md border border-border bg-panel px-2 py-1 text-muted-foreground">
                    {form.region}
                  </span>
                  <span className="rounded-md border border-border bg-panel px-2 py-1 text-muted-foreground">
                    {form.game}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-md border border-border bg-panel px-2 py-1 capitalize text-muted-foreground">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background:
                          STATUSES.find((s) => s.id === form.status)?.dot ?? "gray",
                      }}
                    />
                    {form.status}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {tab === "conta" && (
            <section className="panel space-y-4 p-5">
              <h2 className="font-display text-base font-bold">Informações da conta</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nick">
                  <input
                    value={form.nickname}
                    onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                    className="input-dark"
                  />
                </Field>
                <Field label="Usuário">
                  <input
                    value={form.handle}
                    onChange={(e) => setForm({ ...form, handle: e.target.value })}
                    className="input-dark"
                  />
                </Field>
                <Field label="E-mail" className="sm:col-span-2">
                  <input value={player.email} readOnly className="input-dark opacity-70" />
                </Field>
                <Field label="Bio" className="sm:col-span-2">
                  <textarea
                    rows={3}
                    maxLength={190}
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    className="input-dark resize-none"
                  />
                  <span className="mt-1 block text-right text-[10px] text-muted-foreground">
                    {form.bio.length}/190
                  </span>
                </Field>
                <Field label="Região">
                  <select
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    className="input-dark"
                  >
                    {["BR-Sul", "BR-Sudeste", "BR-Nordeste", "LATAM", "NA-Leste"].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Jogo principal">
                  <select
                    value={form.game}
                    onChange={(e) => setForm({ ...form, game: e.target.value })}
                    className="input-dark"
                  >
                    {["EA FC 27", "Valorant", "CS2", "Rocket League", "Fortnite"].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div>
                <p className="label-caps">Status</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setForm({ ...form, status: s.id })}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        form.status === s.id
                          ? "border border-primary/50 bg-primary/20"
                          : "border border-border bg-panel text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: s.dot }}
                      />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "aparencia" && (
            <section className="panel space-y-5 p-5">
              <h2 className="font-display text-base font-bold">Aparência do perfil</h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="label-caps">Foto de perfil</p>
                  <div className="mt-3 flex items-center gap-4">
                    <ProfileAvatar
                      name={form.nickname}
                      size={72}
                      borderId={player.equipped.border}
                      avatarUrl={form.avatarUrl}
                    />
                    <div className="space-y-2">
                      <button
                        onClick={() => avatarInput.current?.click()}
                        className="btn-primary flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        <Upload className="h-3.5 w-3.5" /> Enviar do dispositivo
                      </button>
                      {form.avatarUrl && (
                        <button
                          onClick={() => {
                            setForm((f) => ({ ...f, avatarUrl: "" }));
                            update({ avatarUrl: "" });
                          }}
                          className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover
                        </button>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        JPG, PNG ou GIF — recortado para 320px.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="label-caps">Banner personalizado</p>
                  <div
                    className="mt-3 h-24 rounded-lg border border-border"
                    style={{
                      backgroundImage: form.bannerUrl
                        ? `url(${form.bannerUrl})`
                        : equippedBanner?.gradient,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <button
                    onClick={() => bannerInput.current?.click()}
                    className="btn-primary mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
                  >
                    <Upload className="h-3.5 w-3.5" /> Enviar banner
                  </button>
                </div>
              </div>

              <div>
                <p className="label-caps flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" /> Cor de destaque
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, accent: c })}
                      aria-label={`Cor ${c}`}
                      className={`grid h-9 w-9 place-items-center rounded-full transition-transform hover:scale-110 ${
                        form.accent === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""
                      }`}
                      style={{ background: c, boxShadow: `0 0 16px ${c}` }}
                    >
                      {form.accent === c && <Check className="h-4 w-4 text-background" />}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "itens" && (
            <section className="space-y-5">
              {(
                [
                  { slot: "border" as const, title: "Molduras" },
                  { slot: "title" as const, title: "Títulos" },
                  { slot: "banner" as const, title: "Banners" },
                ]
              ).map(({ slot, title: groupTitle }) => (
                <div key={slot} className="panel p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold">{groupTitle}</h2>
                    <Link to="/loja" className="text-xs font-semibold text-primary-glow">
                      Ver na loja
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {STORE_ITEMS.filter((i) => i.kind === slot).map((item) => {
                      const owned = player.owned.includes(item.id);
                      const active = player.equipped[slot] === item.id;
                      return (
                        <button
                          key={item.id}
                          disabled={!owned}
                          onClick={() => equip(item)}
                          className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                            active
                              ? "border-success/60 bg-success/10"
                              : owned
                                ? "border-border bg-panel hover:-translate-y-0.5 hover:border-primary/50"
                                : "cursor-not-allowed border-border/60 bg-panel/40 opacity-60"
                          }`}
                        >
                          {slot === "border" && (
                            <ProfileAvatar
                              name={form.nickname}
                              size={46}
                              borderId={item.id}
                              avatarUrl={form.avatarUrl}
                            />
                          )}
                          {slot === "banner" && (
                            <span
                              className="h-11 w-16 shrink-0 rounded-md border border-border"
                              style={{ backgroundImage: item.gradient }}
                            />
                          )}
                          {slot === "title" && (
                            <span className="grid h-11 w-16 shrink-0 place-items-center rounded-md border border-primary/40 bg-primary/10 text-[9px] font-bold text-primary-glow">
                              {item.label || "—"}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                              {item.name}
                              {active && <Check className="h-3.5 w-3.5 text-success" />}
                              {!owned && <Lock className="h-3 w-3 text-muted-foreground" />}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {owned ? item.desc : `Requer level ${item.minLevel} • ${item.price} moedas`}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          )}

          {tab === "privacidade" && (
            <section className="panel space-y-3 p-5">
              <h2 className="font-display text-base font-bold">Privacidade e segurança</h2>
              {[
                {
                  key: "privateProfile" as const,
                  label: "Perfil privado",
                  hint: "Só amigos veem seu histórico de partidas.",
                },
                {
                  key: "allowInvites" as const,
                  label: "Permitir convites de lobby",
                  hint: "Qualquer jogador do servidor pode te chamar.",
                },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setForm({ ...form, [t.key]: !form[t.key] })}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-panel px-4 py-3 text-left text-sm"
                >
                  <span>
                    <span className="font-semibold">{t.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{t.hint}</span>
                  </span>
                  <span
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                      form[t.key] ? "bg-primary" : "bg-secondary"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all ${
                        form[t.key] ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
              ))}

              <button
                onClick={() => {
                  reset();
                  flash("Conta resetada para level 0");
                }}
                className="btn-ghost mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <RotateCcw className="h-4 w-4" /> Resetar conta (level 0)
              </button>
            </section>
          )}

          {/* Barra de ações */}
          <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/90 px-4 py-3 backdrop-blur-md">
            <p className="text-xs text-muted-foreground">
              {dirty ? "Você tem alterações não salvas." : "Tudo salvo neste dispositivo."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setForm(player)}
                disabled={!dirty}
                className="btn-ghost rounded-lg px-3 py-2 text-sm disabled:opacity-40"
              >
                Descartar
              </button>
              <button
                onClick={save}
                className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
              >
                <Save className="h-4 w-4" /> Salvar
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-primary/50 bg-card px-4 py-2.5 text-sm font-semibold shadow-[0_0_30px_oklch(0.58_0.24_300/0.35)]">
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label-caps">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
