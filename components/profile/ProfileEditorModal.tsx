"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  Crown,
  ImagePlus,
  Loader2,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import {
  DEFAULT_PROFILE_BADGE,
  DEFAULT_PROFILE_BANNER,
  DEFAULT_PROFILE_CARD_STYLE,
  DEFAULT_PROFILE_EFFECT,
  DEFAULT_PROFILE_FRAME,
  PROFILE_BADGES,
  PROFILE_BANNERS,
  PROFILE_CARD_STYLES,
  PROFILE_EFFECTS,
  PROFILE_FRAMES,
  PROFILE_GAMES,
  PROFILE_REGIONS,
} from "@/lib/profile-cosmetics";
import { DEFAULT_PROFILE_COSMETICS, normalizeCosmeticState } from "@/lib/cosmetic-state";

type ProfileForm = {
  username: string;
  displayName: string;
  bio: string;
  favoriteGame: string;
  region: string;
  socialDiscord: string;
  socialInstagram: string;
  socialTwitch: string;
  avatarUrl: string;
  bannerUrl: string;
};

type EditorTab = "Perfil" | "Aparência" | "Conquistas";
type AppearanceTab = "Banners" | "Molduras" | "Efeitos" | "Badges";

const defaultProfile: ProfileForm = {
  username: "juann",
  displayName: "Juan",
  bio: "",
  favoriteGame: "EA FC 27",
  region: "Brasil",
  socialDiscord: "",
  socialInstagram: "",
  socialTwitch: "",
  avatarUrl: "",
  bannerUrl: "",
};

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "GL";
}

function CosmeticBanner({ id, compact = false }: { id: string; compact?: boolean }) {
  const banner = PROFILE_BANNERS.find((item) => item.id === id) ?? PROFILE_BANNERS[0];
  return (
    <div
      className={`profile-banner-fx profile-banner-${banner.variant ?? "rift"} relative overflow-hidden rounded-xl ${compact ? "h-16" : "h-36 md:h-40"}`}
      style={{ background: banner.gradient, "--fx-accent": banner.accent, "--fx-glow": banner.glow } as CSSProperties}
    >
      <span className="profile-banner-depth" />
      <span className="profile-banner-orb profile-banner-orb-a" />
      <span className="profile-banner-orb profile-banner-orb-b" />
      <span className="profile-banner-beam profile-banner-beam-a" />
      <span className="profile-banner-beam profile-banner-beam-b" />
      <span className="profile-banner-particles" />
      <span className="profile-banner-grain" />
    </div>
  );
}

function AvatarFrame({ frameId, size = 82, children }: { frameId: string; effectId: string; size?: number; children: React.ReactNode }) {
  const frame = PROFILE_FRAMES.find((item) => item.id === frameId) ?? PROFILE_FRAMES.find((item) => item.id === "none")!;
  const hasFrame = frame.id !== "none";
  return (
    <div className={`profile-avatar-shell ${hasFrame ? "profile-avatar-has-frame" : "profile-avatar-no-frame"}`} style={{ width: size, height: size, "--frame-ring": frame.ring, "--frame-glow": frame.glow } as CSSProperties}>
      {hasFrame && <div className="profile-avatar-frame" />}
      <div className="profile-avatar-core">{children}</div>
      {hasFrame && <><div className="profile-avatar-spark profile-avatar-spark-a" /><div className="profile-avatar-spark profile-avatar-spark-b" /></>}
    </div>
  );
}

export default function ProfileEditorModal() {
  const router = useRouter();
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const bannerInput = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<EditorTab>("Perfil");
  const [appearanceTab, setAppearanceTab] = useState<AppearanceTab>("Banners");
  const [form, setForm] = useState<ProfileForm>(defaultProfile);
  const [selectedBanner, setSelectedBanner] = useState(DEFAULT_PROFILE_BANNER);
  const [selectedFrame, setSelectedFrame] = useState(DEFAULT_PROFILE_FRAME);
  const [selectedEffect, setSelectedEffect] = useState(DEFAULT_PROFILE_EFFECT);
  const [selectedBadge, setSelectedBadge] = useState(DEFAULT_PROFILE_BADGE);
  const [selectedCardStyle, setSelectedCardStyle] = useState(DEFAULT_PROFILE_CARD_STYLE);
  const [cosmetics, setCosmetics] = useState(DEFAULT_PROFILE_COSMETICS);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o perfil.");
        if (!mounted) return;
        const profile = payload.profile ?? {};
        const admin = profile.app_role === "admin";
        const state = normalizeCosmeticState({ owned: profile.cosmetic_owned ?? [], equipped: profile.cosmetic_equipped ?? {} }, admin);
        setIsAdmin(admin);
        setCosmetics(state);
        setForm({
          username: profile.username ?? defaultProfile.username,
          displayName: profile.display_name ?? defaultProfile.displayName,
          bio: profile.bio ?? "",
          favoriteGame: profile.favorite_game ?? defaultProfile.favoriteGame,
          region: profile.region ?? defaultProfile.region,
          socialDiscord: profile.social_discord ?? "",
          socialInstagram: profile.social_instagram ?? "",
          socialTwitch: profile.social_twitch ?? "",
          avatarUrl: profile.avatar ?? "",
          bannerUrl: profile.profile_banner ?? "",
        });
        setSelectedBanner(profile.profile_banner ? "custom" : state.equipped.banner || DEFAULT_PROFILE_BANNER);
        setSelectedFrame(state.equipped.frame || profile.avatar_frame || DEFAULT_PROFILE_FRAME);
        setSelectedEffect(state.equipped.effect || profile.profile_effect || DEFAULT_PROFILE_EFFECT);
        setSelectedBadge(state.equipped.badge || profile.profile_badge || DEFAULT_PROFILE_BADGE);
        setSelectedCardStyle(state.equipped.cardStyle || profile.profile_card_style || DEFAULT_PROFILE_CARD_STYLE);
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Falha ao carregar o perfil.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const frameMeta = useMemo(() => PROFILE_FRAMES.find((item) => item.id === selectedFrame) ?? PROFILE_FRAMES.find((item) => item.id === "none")!, [selectedFrame]);
  const effectMeta = useMemo(() => PROFILE_EFFECTS.find((item) => item.id === selectedEffect) ?? PROFILE_EFFECTS[0], [selectedEffect]);
  const badgeMeta = useMemo(() => PROFILE_BADGES.find((item) => item.id === selectedBadge) ?? PROFILE_BADGES[PROFILE_BADGES.length - 1], [selectedBadge]);
  const cardMeta = useMemo(() => PROFILE_CARD_STYLES.find((item) => item.id === selectedCardStyle) ?? PROFILE_CARD_STYLES[0], [selectedCardStyle]);

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  async function upload(type: "avatar" | "banner", file: File | undefined) {
    if (!file) return;
    setUploading(type);
    setError("");
    try {
      const body = new FormData();
      body.append("type", type);
      body.append("file", file);
      const response = await fetch("/api/profile/upload", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha no upload.");
      setForm((current) => ({ ...current, [type === "avatar" ? "avatarUrl" : "bannerUrl"]: payload.url }));
      if (type === "banner") setSelectedBanner("custom");
      setNotice(type === "avatar" ? "Foto aplicada ao perfil. Salve para manter também os demais ajustes." : "Banner aplicado ao perfil. Salve para manter também os demais ajustes.");
      window.dispatchEvent(new CustomEvent("grindlobby:profile-updated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha no upload.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const nextCosmetics = normalizeCosmeticState({
        owned: cosmetics.owned,
        equipped: {
          banner: selectedBanner === "custom" ? (form.bannerUrl || DEFAULT_PROFILE_BANNER) : selectedBanner,
          frame: selectedFrame,
          effect: selectedEffect,
          badge: selectedBadge,
          cardStyle: selectedCardStyle,
          bundle: cosmetics.equipped.bundle,
        },
      }, isAdmin);
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          displayName: form.displayName,
          bio: form.bio,
          favoriteGame: form.favoriteGame,
          region: form.region,
          socialDiscord: form.socialDiscord,
          socialInstagram: form.socialInstagram,
          socialTwitch: form.socialTwitch,
          avatarUrl: form.avatarUrl,
          bannerUrl: form.bannerUrl,
          avatarFrame: selectedFrame,
          profileEffect: selectedEffect,
          profileBadge: selectedBadge,
          profileCardStyle: selectedCardStyle,
          cosmetics: nextCosmetics,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar.");
      setCosmetics(nextCosmetics);
      setNotice("Perfil atualizado.");
      window.dispatchEvent(new CustomEvent("grindlobby:profile-updated"));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const customBannerStyle = form.bannerUrl ? { backgroundImage: `linear-gradient(90deg,rgba(5,6,12,.94),rgba(5,6,12,.16)),url(${form.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6">
      <section className="profile-editor-modal relative flex max-h-[92vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[26px] border border-violet-400/20 bg-[#090b11]/96 shadow-[0_34px_120px_rgba(0,0,0,.72),0_0_80px_rgba(124,58,237,.18)] backdrop-blur-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-4 py-3 md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={goBack} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.035] text-zinc-300 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white" aria-label="Voltar">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold text-white md:text-xl">Editar perfil</h1>
              <p className="hidden text-xs text-zinc-500 sm:block">Personalize seu perfil sem sair do dashboard.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && <span className="hidden rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-violet-200 md:inline-flex">Admin · tudo liberado</span>}
            <button onClick={save} disabled={saving || loading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-3.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(139,92,246,.34)] transition hover:brightness-110 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={15} />}
              <span className="hidden sm:inline">Salvar</span>
            </button>
            <button onClick={goBack} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white" aria-label="Fechar"><X size={18} /></button>
          </div>
        </header>

        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/8 px-4 py-2.5 md:px-5">
          {(["Perfil", "Aparência", "Conquistas"] as EditorTab[]).map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${tab === item ? "border-violet-400/35 bg-violet-500/12 text-violet-100 shadow-[0_0_18px_rgba(139,92,246,.14)]" : "border-transparent text-zinc-400 hover:bg-white/[.035] hover:text-white"}`}>{item}</button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
          {loading ? (
            <div className="grid min-h-[520px] place-items-center"><Loader2 className="animate-spin text-violet-300" size={28} /></div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
              <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
                <div className={`profile-expanded-card overflow-hidden rounded-2xl border border-white/10 bg-[#0c0f16] shadow-[0_18px_48px_rgba(0,0,0,.35)] ${effectMeta.id !== "none" ? "profile-card-aura" : ""}`} style={{ "--card-aura": effectMeta.glow } as CSSProperties}>
                  <div className="relative h-40 overflow-hidden" style={customBannerStyle}>
                    {!form.bannerUrl && <CosmeticBanner id={selectedBanner === "custom" ? DEFAULT_PROFILE_BANNER : selectedBanner} />}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f16] via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-4 flex items-end gap-3">
                      <AvatarFrame frameId={selectedFrame} effectId={selectedEffect} size={84}>
                        {form.avatarUrl ? <img src={form.avatarUrl} alt="Avatar" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="grid h-full w-full place-items-center bg-gradient-to-br from-violet-500 to-purple-700 text-xl font-black text-white">{initials(form.displayName || form.username)}</span>}
                      </AvatarFrame>
                      <div className="pb-1">
                        <div className="flex items-center gap-1.5"><span className="max-w-[150px] truncate text-lg font-bold text-white">{form.displayName || form.username}</span>{isAdmin && <Crown size={14} className="text-amber-300" />}</div>
                        <div className="text-xs text-zinc-400">@{form.username}</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 p-4" style={{ borderTop: `1px solid ${cardMeta.accent}24` }}>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-md border border-white/10 bg-white/[.035] px-2 py-1 text-[10px] text-zinc-300">{form.favoriteGame || "Sem jogo"}</span>
                      <span className="rounded-md border border-white/10 bg-white/[.035] px-2 py-1 text-[10px] text-zinc-300">{form.region || "Sem região"}</span>
                      {badgeMeta.id !== "none" && <span className="rounded-md px-2 py-1 text-[10px] font-semibold" style={{ color: badgeMeta.accent, background: `${badgeMeta.accent}14`, border: `1px solid ${badgeMeta.accent}33` }}>{badgeMeta.label}</span>}
                    </div>
                    <p className="min-h-10 text-xs leading-5 text-zinc-400">{form.bio || "Sua bio aparecerá aqui."}</p>
                    <div>
                      <div className="mb-1 flex justify-between text-[10px] text-zinc-500"><span>Level 0</span><span>0 / 400 XP</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/6"><div className="h-full w-[6%] rounded-full bg-gradient-to-r from-violet-500 to-purple-400" /></div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0c0f16] p-3.5">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-500">Upload real</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => avatarInput.current?.click()} className="group flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-violet-400/30 bg-violet-500/[.06] text-center transition hover:border-violet-300/60 hover:bg-violet-500/10">
                      {uploading === "avatar" ? <Loader2 size={18} className="animate-spin text-violet-300" /> : <Camera size={18} className="text-violet-300" />}
                      <span className="text-[11px] font-semibold text-zinc-200">Foto própria</span>
                      <span className="text-[9px] text-zinc-500">PNG/JPG/WEBP · 5MB</span>
                    </button>
                    <button onClick={() => bannerInput.current?.click()} className="group flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-fuchsia-400/25 bg-fuchsia-500/[.05] text-center transition hover:border-fuchsia-300/55 hover:bg-fuchsia-500/10">
                      {uploading === "banner" ? <Loader2 size={18} className="animate-spin text-fuchsia-300" /> : <ImagePlus size={18} className="text-fuchsia-300" />}
                      <span className="text-[11px] font-semibold text-zinc-200">Banner próprio</span>
                      <span className="text-[9px] text-zinc-500">PNG/JPG/WEBP · 10MB</span>
                    </button>
                  </div>
                  <input ref={avatarInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { void upload("avatar", event.target.files?.[0]); event.currentTarget.value = ""; }} />
                  <input ref={bannerInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { void upload("banner", event.target.files?.[0]); event.currentTarget.value = ""; }} />
                </div>
              </aside>

              <main className="min-w-0 space-y-3">
                {error && <div className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">{error}</div>}
                {notice && <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">{notice}</div>}

                {tab === "Perfil" && (
                  <div className="rounded-2xl border border-white/10 bg-[#0c0f16] p-4">
                    <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Dados do perfil</h2><p className="mt-0.5 text-[11px] text-zinc-500">O que outros jogadores veem sobre você.</p></div><BadgeCheck size={18} className="text-violet-300" /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5"><span className="text-[10px] uppercase tracking-[.13em] text-zinc-500">Nome de exibição</span><input value={form.displayName} onChange={(e) => setForm((c) => ({ ...c, displayName: e.target.value }))} className="profile-field" /></label>
                      <label className="space-y-1.5"><span className="text-[10px] uppercase tracking-[.13em] text-zinc-500">Username</span><input value={form.username} onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))} className="profile-field" /></label>
                      <label className="space-y-1.5 sm:col-span-2"><span className="flex justify-between text-[10px] uppercase tracking-[.13em] text-zinc-500"><span>Bio</span><span>{form.bio.length}/120</span></span><textarea value={form.bio} onChange={(e) => setForm((c) => ({ ...c, bio: e.target.value.slice(0, 120) }))} className="profile-field min-h-20 resize-none" /></label>
                      <label className="space-y-1.5"><span className="text-[10px] uppercase tracking-[.13em] text-zinc-500">Jogo favorito</span><select value={form.favoriteGame} onChange={(e) => setForm((c) => ({ ...c, favoriteGame: e.target.value }))} className="profile-field">{PROFILE_GAMES.map((game) => <option key={game}>{game}</option>)}</select></label>
                      <label className="space-y-1.5"><span className="text-[10px] uppercase tracking-[.13em] text-zinc-500">Região</span><select value={form.region} onChange={(e) => setForm((c) => ({ ...c, region: e.target.value }))} className="profile-field">{PROFILE_REGIONS.map((region) => <option key={region}>{region}</option>)}</select></label>
                      <label className="space-y-1.5"><span className="text-[10px] uppercase tracking-[.13em] text-zinc-500">Discord</span><input value={form.socialDiscord} onChange={(e) => setForm((c) => ({ ...c, socialDiscord: e.target.value }))} className="profile-field" placeholder="@usuario" /></label>
                      <label className="space-y-1.5"><span className="text-[10px] uppercase tracking-[.13em] text-zinc-500">Instagram</span><input value={form.socialInstagram} onChange={(e) => setForm((c) => ({ ...c, socialInstagram: e.target.value }))} className="profile-field" placeholder="@usuario" /></label>
                    </div>
                    <button onClick={() => setTab("Aparência")} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-violet-200">Personalizar cosméticos <ChevronRight size={14} /></button>
                  </div>
                )}

                {tab === "Aparência" && (
                  <div className="rounded-2xl border border-white/10 bg-[#0c0f16] p-4">
                    <div className="mb-4"><h2 className="text-sm font-semibold text-white">Cosméticos</h2><p className="mt-1 text-[11px] text-zinc-500">Efeitos renderizados de verdade, não blocos de cor.</p></div>
                    <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-xl border border-white/8 bg-black/20 p-1.5">
                      {(["Banners", "Molduras", "Efeitos", "Badges"] as AppearanceTab[]).map((item) => <button key={item} onClick={() => setAppearanceTab(item)} className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-semibold transition ${appearanceTab === item ? "bg-violet-500/18 text-violet-100 shadow-[0_0_18px_rgba(139,92,246,.16)]" : "text-zinc-500 hover:text-white"}`}>{item}</button>)}
                    </div>

                    {appearanceTab === "Banners" && <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{PROFILE_BANNERS.map((banner) => <button key={banner.id} onClick={() => { setSelectedBanner(banner.id); setForm((c) => ({ ...c, bannerUrl: "" })); }} className={`group overflow-hidden rounded-xl border p-1.5 text-left transition hover:-translate-y-0.5 ${selectedBanner === banner.id && !form.bannerUrl ? "border-violet-400/55 bg-violet-500/8 shadow-[0_0_28px_rgba(139,92,246,.18)]" : "border-white/10 bg-black/20 hover:border-white/20"}`}><div className="relative"><CosmeticBanner id={banner.id} compact />{selectedBanner === banner.id && !form.bannerUrl && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-violet-500 text-white"><Check size={12} /></span>}</div><div className="px-1 pt-2 text-[11px] font-semibold text-zinc-200">{banner.label}</div><div className="px-1 pb-1 text-[9px] text-zinc-500">Animado · profundidade · partículas</div></button>)}</div>}

                    {appearanceTab === "Molduras" && <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{PROFILE_FRAMES.map((frame) => <button key={frame.id} onClick={() => setSelectedFrame(frame.id)} className={`group flex flex-col items-center gap-2 rounded-xl border p-2.5 transition hover:-translate-y-0.5 ${selectedFrame === frame.id ? "border-violet-400/50 bg-violet-500/8" : "border-white/10 bg-black/20 hover:border-white/20"}`}><AvatarFrame frameId={frame.id} effectId="none" size={54}><span className="grid h-full w-full place-items-center bg-[#11141c] text-xs font-bold text-white">{initials(form.displayName)}</span></AvatarFrame><span className="max-w-full truncate text-[9px] text-zinc-300">{frame.label}</span></button>)}</div>}

                    {appearanceTab === "Efeitos" && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{PROFILE_EFFECTS.map((effect) => <button key={effect.id} onClick={() => setSelectedEffect(effect.id)} className={`relative overflow-hidden rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${selectedEffect === effect.id ? "border-violet-400/50 bg-violet-500/8" : "border-white/10 bg-black/20 hover:border-white/20"}`}><div className={`profile-effect-swatch profile-effect-${effect.variant ?? "none"}`} style={{ "--effect-glow": effect.glow } as CSSProperties}><Sparkles size={20} /></div><p className="mt-2 text-[10px] font-semibold text-zinc-200">{effect.label}</p><p className="mt-0.5 text-[9px] text-zinc-500">Aura dinâmica</p></button>)}</div>}

                    {appearanceTab === "Badges" && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{PROFILE_BADGES.map((badge) => <button key={badge.id} onClick={() => setSelectedBadge(badge.id)} className={`rounded-xl border p-3 text-left transition ${selectedBadge === badge.id ? "border-violet-400/50 bg-violet-500/8" : "border-white/10 bg-black/20 hover:border-white/20"}`}><div className="mb-3 grid h-9 w-9 place-items-center rounded-lg" style={{ color: badge.accent, background: `${badge.accent}12`, border: `1px solid ${badge.accent}30`, boxShadow: `0 0 22px ${badge.accent}18` }}><Crown size={16} /></div><p className="text-[10px] font-semibold text-zinc-200">{badge.label}</p></button>)}</div>}

                    <div className="mt-4 border-t border-white/8 pt-4"><p className="mb-2 text-[10px] uppercase tracking-[.14em] text-zinc-500">Estilo do cartão</p><div className="flex flex-wrap gap-2">{PROFILE_CARD_STYLES.map((style) => <button key={style.id} onClick={() => setSelectedCardStyle(style.id)} className={`rounded-lg border px-3 py-2 text-[10px] font-semibold transition ${selectedCardStyle === style.id ? "border-white/25 text-white" : "border-white/8 text-zinc-500 hover:text-white"}`} style={selectedCardStyle === style.id ? { background: style.panel, boxShadow: `0 0 18px ${style.accent}22` } : undefined}>{style.label}</button>)}</div></div>
                  </div>
                )}

                {tab === "Conquistas" && (
                  <div className="rounded-2xl border border-white/10 bg-[#0c0f16] p-4"><div className="mb-4"><h2 className="text-sm font-semibold text-white">Conquistas em destaque</h2><p className="mt-1 text-[11px] text-zinc-500">Progresso real será exibido conforme os eventos competitivos forem registrados.</p></div><div className="grid gap-2 sm:grid-cols-2">{[
                    ["Primeiro Passo", "Participe do 1º lobby", true],
                    ["Social", "Convide 1 amigo", true],
                    ["Dedicado", "Fique online por 5h", false],
                    ["Competitivo", "Vença 10 partidas", false],
                  ].map(([name, description, done]) => <div key={String(name)} className="rounded-xl border border-white/8 bg-black/20 p-3"><div className="flex items-start gap-3"><div className={`grid h-10 w-10 place-items-center rounded-xl border ${done ? "border-emerald-400/25 bg-emerald-500/8 text-emerald-300" : "border-violet-400/20 bg-violet-500/8 text-violet-300"}`}><Crown size={17} /></div><div><p className="text-xs font-semibold text-white">{String(name)}</p><p className="mt-1 text-[10px] text-zinc-500">{String(description)}</p><p className={`mt-2 text-[9px] font-semibold uppercase ${done ? "text-emerald-400" : "text-zinc-600"}`}>{done ? "Conquistada" : "Em progresso"}</p></div></div></div>)}</div></div>
                )}
              </main>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/8 bg-black/15 px-4 py-3 md:px-5">
          <div className="min-w-0"><p className="truncate text-[10px] text-zinc-500">As alterações só entram no perfil após salvar.</p></div>
          <div className="flex gap-2"><button onClick={goBack} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/5">Cancelar</button><button onClick={save} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-4 py-2 text-xs font-bold text-white shadow-[0_0_26px_rgba(139,92,246,.30)] disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Salvar alterações</button></div>
        </footer>
      </section>
    </div>
  );
}
