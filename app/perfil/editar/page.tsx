"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Crown, Globe, Instagram, Shield, Sparkles, Twitch, Upload } from "lucide-react";
import { PROFILE_BADGES, PROFILE_BANNERS, PROFILE_CARD_STYLES, PROFILE_EFFECTS, PROFILE_FRAMES, PROFILE_GAMES, PROFILE_REGIONS, DEFAULT_PROFILE_BANNER, DEFAULT_PROFILE_EFFECT, DEFAULT_PROFILE_FRAME, DEFAULT_PROFILE_BADGE, DEFAULT_PROFILE_CARD_STYLE } from "@/lib/profile-cosmetics";
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
  avatarFrame: string;
  profileEffect: string;
  profileBadge: string;
  profileCardStyle: string;
};

const tabs = ["Perfil", "Aparência", "Conquistas", "Privacidade"] as const;
const cosmeticTabs = ["Banner", "Moldura", "Efeitos", "Papel de parede"] as const;

const defaultProfile: ProfileForm = {
  username: "juann",
  displayName: "Juann",
  bio: "",
  favoriteGame: "EA FC 27",
  region: "Brasil",
  socialDiscord: "",
  socialInstagram: "",
  socialTwitch: "",
  avatarUrl: "",
  bannerUrl: "",
  avatarFrame: DEFAULT_PROFILE_FRAME,
  profileEffect: DEFAULT_PROFILE_EFFECT,
  profileBadge: DEFAULT_PROFILE_BADGE,
  profileCardStyle: DEFAULT_PROFILE_CARD_STYLE,
};

function getInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "GL";
}

function normalizeUrl(value: string) {
  if (!value) return "";
  return value.startsWith("http") ? value : `https://${value}`;
}

export default function EditProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Perfil");
  const [activeCosmeticTab, setActiveCosmeticTab] = useState<(typeof cosmeticTabs)[number]>("Banner");
  const [form, setForm] = useState<ProfileForm>(defaultProfile);
  const [selectedBanner, setSelectedBanner] = useState(DEFAULT_PROFILE_BANNER);
  const [selectedFrame, setSelectedFrame] = useState(DEFAULT_PROFILE_FRAME);
  const [selectedEffect, setSelectedEffect] = useState(DEFAULT_PROFILE_EFFECT);
  const [selectedBadge, setSelectedBadge] = useState(DEFAULT_PROFILE_BADGE);
  const [selectedCardStyle, setSelectedCardStyle] = useState(DEFAULT_PROFILE_CARD_STYLE);
  const [cosmeticState, setCosmeticState] = useState(DEFAULT_PROFILE_COSMETICS);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Falha ao carregar o perfil.");
        const profile = payload.profile ?? {};
        const sharedCosmetics = normalizeCosmeticState({
          owned: profile.cosmetic_owned ?? [],
          equipped: profile.cosmetic_equipped ?? {},
        }, Boolean(profile?.app_role === "admin"));

        const next: ProfileForm = {
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
          avatarFrame: profile.avatar_frame ?? DEFAULT_PROFILE_FRAME,
          profileEffect: profile.profile_effect ?? DEFAULT_PROFILE_EFFECT,
          profileBadge: profile.profile_badge ?? DEFAULT_PROFILE_BADGE,
          profileCardStyle: profile.profile_card_style ?? DEFAULT_PROFILE_CARD_STYLE,
        };
        setForm(next);
        setCosmeticState(sharedCosmetics);
        setSelectedBanner(profile.profile_banner ? "custom" : sharedCosmetics.equipped.banner || DEFAULT_PROFILE_BANNER);
        setSelectedFrame(sharedCosmetics.equipped.frame || next.avatarFrame);
        setSelectedEffect(sharedCosmetics.equipped.effect || next.profileEffect);
        setSelectedBadge(sharedCosmetics.equipped.badge || next.profileBadge);
        setSelectedCardStyle(sharedCosmetics.equipped.cardStyle || next.profileCardStyle);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Falha ao carregar o perfil.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const avatarFrameMeta = useMemo(() => PROFILE_FRAMES.find((frame) => frame.id === selectedFrame) ?? PROFILE_FRAMES[0], [selectedFrame]);
  const badgeMeta = useMemo(() => PROFILE_BADGES.find((badge) => badge.id === selectedBadge) ?? PROFILE_BADGES[0], [selectedBadge]);
  const cardStyleMeta = useMemo(() => PROFILE_CARD_STYLES.find((style) => style.id === selectedCardStyle) ?? PROFILE_CARD_STYLES[0], [selectedCardStyle]);
  const activeBanner = useMemo(() => PROFILE_BANNERS.find((banner) => banner.id === selectedBanner) ?? PROFILE_BANNERS[0], [selectedBanner]);
  const activeEffect = useMemo(() => PROFILE_EFFECTS.find((effect) => effect.id === selectedEffect) ?? PROFILE_EFFECTS[0], [selectedEffect]);

  async function uploadFile(type: "avatar" | "banner", file: File | null) {
    if (!file) return;
    const form = new FormData();
    form.append("type", type);
    form.append("file", file);
    const response = await fetch("/api/profile/upload", { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Falha ao subir imagem.");
    const url = payload.url as string;
    if (type === "avatar") {
      setForm((current) => ({ ...current, avatarUrl: url }));
    } else {
      setForm((current) => ({ ...current, bannerUrl: url }));
      setSelectedBanner("custom");
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    try {
      setError("");
      await uploadFile("avatar", file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao enviar a imagem.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleBannerChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    try {
      setError("");
      await uploadFile("banner", file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao enviar o banner.");
    } finally {
      event.target.value = "";
    }
  }

  async function saveProfile() {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const nextCosmeticState = normalizeCosmeticState({
        owned: cosmeticState.owned,
        equipped: {
          banner: selectedBanner === "custom" ? (form.bannerUrl || DEFAULT_PROFILE_BANNER) : selectedBanner,
          frame: selectedFrame,
          effect: selectedEffect,
          badge: selectedBadge,
          cardStyle: selectedCardStyle,
          bundle: cosmeticState.equipped.bundle,
        },
      }, true);

      setCosmeticState(nextCosmeticState);

      const payload = {
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
        cosmetics: nextCosmeticState,
      };
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao salvar.");
      setNotice("Perfil atualizado");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const bannerBackground = form.bannerUrl ? `url(${form.bannerUrl}) center/cover no-repeat` : activeBanner.gradient;

  return (
    <div className="min-h-screen bg-[#06070b] text-white">
      <div className="mx-auto max-w-[1600px] px-4 py-4 md:px-6">
        <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_360px]">
          <aside className="hidden min-h-[calc(100vh-2rem)] rounded-2xl border border-white/10 bg-[#0e0f14]/90 p-5 xl:flex xl:flex-col">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-sm font-black">GL</div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-violet-300">GrindLobby</div>
                <div className="text-sm font-semibold text-white">Dashboard</div>
              </div>
            </div>
            <nav className="space-y-2">
              {[
                ["Dashboard", "Panel"],
                ["Lobbies", "Live"],
                ["Rank", "Pro"],
                ["Loja", "Store"],
                ["Configurações", "System"],
              ].map(([label, status], index) => (
                <button key={label} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${index === 0 ? "border-violet-500/40 bg-violet-500/10 text-violet-100" : "border-transparent bg-white/0 text-zinc-300 hover:bg-white/5"}`}>
                  <span>{label}</span>
                  {index === 3 ? <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-200">{status}</span> : <span className="text-[10px] uppercase text-zinc-500">{status}</span>}
                </button>
              ))}
            </nav>
            <div className="mt-8 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="grid h-12 w-12 place-items-center rounded-full border border-violet-400/40 bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold">{getInitials(form.displayName || form.username)}</div>
                  <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#0f1014] bg-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{form.displayName || form.username}</p>
                  <p className="truncate text-[11px] text-zinc-400">@{form.username}</p>
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0 rounded-[22px] border border-white/10 bg-[#0b0d12]/90 p-4 md:p-6">
            <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-violet-300">
                  <Shield size={12} />
                  <span>Configuração</span>
                </div>
                <h1 className="font-display text-3xl font-bold tracking-[-0.06em] text-white md:text-4xl">Editar perfil</h1>
                <p className="mt-2 text-sm text-zinc-400">Personalize sua identidade no GrindLobby.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button className="rounded-xl border border-white/10 bg-white/0 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/5">Visualizar perfil</button>
                <button onClick={saveProfile} disabled={saving} className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(139,92,246,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </header>

            <div className="mb-6 flex overflow-x-auto gap-2 border-b border-white/10 pb-2">
              {tabs.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === tab ? "border border-violet-500/30 bg-violet-500/12 text-violet-100" : "text-zinc-400 hover:bg-white/5"}`}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
              <section className="space-y-5">
                <div className="rounded-2xl border border-white/10 bg-[#111319] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">Foto de perfil</h2>
                    <button className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 hover:text-white" onClick={() => fileInputRef.current?.click()} aria-label="Enviar imagem"><Camera size={15} /></button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} className="hidden" />
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="relative overflow-hidden rounded-full border-2 border-violet-400/60 bg-[#0d0f14] shadow-[0_0_32px_rgba(139,92,246,0.3)]" style={{ width: 124, height: 124 }}>
                        {form.avatarUrl ? (
                          <Image src={form.avatarUrl} alt="Avatar" width={124} height={124} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-violet-500 to-purple-700 text-3xl font-black text-white">{getInitials(form.displayName || form.username)}</div>
                        )}
                        <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 4px ${avatarFrameMeta.accent}55, 0 0 25px ${avatarFrameMeta.glow}` }} />
                      </div>
                      <div className="absolute inset-0 rounded-full" style={{ border: `1px solid ${avatarFrameMeta.accent}`, boxShadow: `0 0 22px ${avatarFrameMeta.glow}` }} />
                    </div>
                    <div className="text-center text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                      <div>PNG, JPG ou WEBP</div>
                      <div className="mt-1 text-violet-300">Máx. 5MB</div>
                    </div>
                    <div className="flex w-full gap-2">
                      <button onClick={() => fileInputRef.current?.click()} className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-purple-700 px-3 py-2.5 text-sm font-medium text-white">Enviar imagem</button>
                      <button onClick={() => setForm((current) => ({ ...current, avatarUrl: "" }))} className="rounded-xl border border-white/10 bg-white/0 px-3 py-2.5 text-sm text-zinc-300">Remover</button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#111319] p-4">
                  <h3 className="mb-4 text-[10px] uppercase tracking-[0.18em] text-zinc-400">Dados pessoais</h3>
                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-zinc-400">Nome de usuário</span>
                      <input value={form.username} onChange={(e) => setForm((curr) => ({ ...curr, username: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-zinc-500 focus:border-violet-500/50" placeholder="juann" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-zinc-400">Bio</span>
                      <textarea value={form.bio} onChange={(e) => setForm((curr) => ({ ...curr, bio: e.target.value.slice(0, 120) }))} className="min-h-[110px] w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-500/50" placeholder="Conte um pouco sobre você..." />
                      <div className="mt-1 text-right text-[11px] text-zinc-400">{form.bio.length}/120</div>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-zinc-400">Jogo favorito</span>
                      <select value={form.favoriteGame} onChange={(e) => setForm((curr) => ({ ...curr, favoriteGame: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500/50">
                        {PROFILE_GAMES.map((game) => <option key={game} value={game}>{game}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-zinc-400">Região</span>
                      <select value={form.region} onChange={(e) => setForm((curr) => ({ ...curr, region: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500/50">
                        {PROFILE_REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
                      </select>
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400"><Globe size={12} /> Redes sociais</div>
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-2.5">
                          <Shield size={15} className="text-violet-300" />
                          <input value={form.socialDiscord} onChange={(e) => setForm((curr) => ({ ...curr, socialDiscord: e.target.value }))} placeholder="Discord" className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none" />
                        </label>
                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-2.5">
                          <Instagram size={15} className="text-violet-300" />
                          <input value={form.socialInstagram} onChange={(e) => setForm((curr) => ({ ...curr, socialInstagram: e.target.value }))} placeholder="Instagram" className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none" />
                        </label>
                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b0d12] px-3 py-2.5">
                          <Twitch size={15} className="text-violet-300" />
                          <input value={form.socialTwitch} onChange={(e) => setForm((curr) => ({ ...curr, socialTwitch: e.target.value }))} placeholder="Twitch" className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-5">
                <div className="rounded-2xl border border-white/10 bg-[#111319] p-4">
                  <h3 className="mb-4 text-[10px] uppercase tracking-[0.18em] text-zinc-400">Personalização</h3>
                  <div className="mb-4 flex overflow-x-auto gap-2">
                    {cosmeticTabs.map((tab) => (
                      <button key={tab} onClick={() => setActiveCosmeticTab(tab)} className={`rounded-xl px-3 py-2 text-sm ${activeCosmeticTab === tab ? "bg-violet-500/12 text-violet-100 border border-violet-500/30" : "text-zinc-400 hover:bg-white/5"}`}>
                        {tab}
                      </button>
                    ))}
                  </div>

                  {activeCosmeticTab === "Banner" && (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {PROFILE_BANNERS.map((banner) => (
                          <button key={banner.id} onClick={() => { setSelectedBanner(banner.id); setForm((curr) => ({ ...curr, bannerUrl: "" })); }} className={`relative h-24 overflow-hidden rounded-2xl border p-2 text-left ${selectedBanner === banner.id ? "border-violet-500/60 ring-1 ring-violet-500/30" : "border-white/10"}`} style={{ background: banner.gradient }}>
                            <div className="absolute inset-0 opacity-80" style={{ background: "linear-gradient(120deg, rgba(255,255,255,0.1), transparent 70%)" }} />
                            <div className="relative z-10 flex h-full items-end justify-between">
                              <span className="text-sm font-semibold text-white">{banner.label}</span>
                              {selectedBanner === banner.id && <Check size={16} className="text-white" />}
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-violet-200">Enviar banner</div>
                            <div className="mt-1 text-xs text-zinc-400">1920x480px ou maior · JPG, PNG ou WEBP · Máx. 10MB</div>
                          </div>
                          <button onClick={() => bannerInputRef.current?.click()} className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-100"><Upload size={15} className="inline-block" /></button>
                        </div>
                        <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleBannerChange} className="hidden" />
                      </div>
                    </div>
                  )}

                  {activeCosmeticTab === "Moldura" && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {PROFILE_FRAMES.map((frame) => (
                        <button key={frame.id} onClick={() => setSelectedFrame(frame.id)} className={`group rounded-2xl border p-3 text-left ${selectedFrame === frame.id ? "border-violet-500/60 bg-violet-500/8" : "border-white/10 bg-[#0b0d12]"}`}>
                          <div className="mb-3 flex justify-center">
                            <div className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-white/10 bg-gradient-to-br from-violet-500 to-purple-700 text-lg font-bold text-white" style={{ boxShadow: `0 0 20px ${frame.glow}` }}>
                              <div className="absolute inset-1 rounded-full" style={{ border: `2px solid ${frame.accent}` }} />
                              <span>J</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-200">{frame.label}</span>
                            {selectedFrame === frame.id && <Check size={16} className="text-violet-200" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {activeCosmeticTab === "Efeitos" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {PROFILE_EFFECTS.map((effect) => (
                        <button key={effect.id} onClick={() => setSelectedEffect(effect.id)} className={`rounded-2xl border p-3 text-left ${selectedEffect === effect.id ? "border-violet-500/60 bg-violet-500/8" : "border-white/10 bg-[#0b0d12]"}`}>
                          <div className="mb-3 flex justify-center">
                            <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-700" style={{ boxShadow: `0 0 18px ${effect.glow}` }}>
                              <div className="absolute inset-[-7px] rounded-full border border-white/20" style={{ boxShadow: `0 0 18px ${effect.ring}` }} />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-200">{effect.label}</span>
                            {selectedEffect === effect.id && <Check size={16} className="text-violet-200" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {activeCosmeticTab === "Papel de parede" && (
                    <div className="rounded-2xl border border-white/10 bg-[#0b0d12] p-4 text-sm text-zinc-300">
                      Papel de parede e fundos de perfil serão sincronizados com a coleção da loja quando o catálogo de cosméticos estiver integrado ao backend.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#111319] p-4">
                  <h3 className="mb-4 text-[10px] uppercase tracking-[0.18em] text-zinc-400">Badges</h3>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {PROFILE_BADGES.map((badge) => (
                      <button key={badge.id} onClick={() => setSelectedBadge(badge.id)} className={`rounded-xl border p-3 text-left ${selectedBadge === badge.id ? "border-violet-500/60 bg-violet-500/8" : "border-white/10 bg-[#0b0d12]"}`}>
                        <div className="mb-2 flex items-center gap-2 text-sm text-white"><span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: badge.accent }} /> {badge.label}</div>
                        <div className="text-[11px] text-zinc-400">{badge.id === "none" ? "Disponível" : "Equipado"}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <aside className="space-y-5">
                <div className="rounded-2xl border border-white/10 bg-[#111319] p-4">
                  <div className="mb-4 text-[10px] uppercase tracking-[0.18em] text-zinc-400">Pré-visualização do perfil</div>
                  <div className="overflow-hidden rounded-2xl border border-violet-500/20 bg-[#0a0d12]">
                    <div className="relative h-52 overflow-hidden" style={{ background: form.bannerUrl ? `url(${form.bannerUrl}) center/cover no-repeat` : activeBanner.gradient, boxShadow: `inset 0 0 30px ${activeBanner.glow}` }}>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.15),transparent_25%)]" />
                      <div className="absolute inset-0 opacity-60" style={{ background: "linear-gradient(90deg, rgba(10,10,12,0.78), rgba(10,10,12,0.12), rgba(10,10,12,0.9))" }} />
                      <div className="absolute left-5 top-5 text-[11px] uppercase tracking-[0.2em] text-violet-200">Admin ativo</div>
                    </div>
                    <div className="relative -mt-12 px-4 pb-4">
                      <div className="flex items-end gap-4">
                        <div className="relative">
                          <div className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-full border-2 bg-[#0c0d12] text-lg font-bold text-white" style={{ borderColor: avatarFrameMeta.accent, boxShadow: `0 0 16px ${avatarFrameMeta.glow}` }}>
                            {form.avatarUrl ? <Image src={form.avatarUrl} alt="Avatar" width={80} height={80} className="h-full w-full object-cover" /> : <span>{getInitials(form.displayName || form.username)}</span>}
                          </div>
                          <div className="absolute inset-1 rounded-full border border-white/10" style={{ boxShadow: `0 0 18px ${activeEffect.glow}` }} />
                        </div>
                        <div className="min-w-0 flex-1 pb-3">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-2xl font-bold tracking-[-0.06em] text-white">{form.displayName || form.username}</h3>
                            {badgeMeta.id !== "none" && <span className="rounded-full border border-violet-500/40 bg-violet-500/12 px-2 py-0.5 text-[10px] font-bold text-violet-100" style={{ background: `${badgeMeta.accent}20`, borderColor: `${badgeMeta.accent}80` }}>{badgeMeta.label}</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-300">
                            <span>@{form.username}</span>
                            <span className="text-zinc-500">•</span>
                            <span>Rank Ouro</span>
                            <span className="text-zinc-500">•</span>
                            <span>{form.region || "Brasil"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-violet-200">
                        <Sparkles size={12} />
                        <span>Pro liberado</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-600" style={{ width: "72%" }} />
                      </div>
                      <div className="mt-3 flex justify-between text-[11px] text-zinc-400"><span>XP</span><span>72 / 100</span></div>
                      <p className="mt-4 text-sm leading-6 text-zinc-300">{form.bio || "Seu perfil ainda está em construção. Adicione uma bio para mostrar sua estilo no GrindLobby."}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(form.favoriteGame ? [form.favoriteGame] : ["EA FC 27"]).map((tag) => <span key={tag} className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-100">{tag}</span>)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#111319] p-4">
                  <div className="mb-4 text-[10px] uppercase tracking-[0.18em] text-zinc-400">Estilo do cartão de perfil</div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {PROFILE_CARD_STYLES.map((style) => (
                      <button key={style.id} onClick={() => setSelectedCardStyle(style.id)} className={`rounded-xl border p-2 text-left ${selectedCardStyle === style.id ? "border-violet-500/50 bg-violet-500/8" : "border-white/10 bg-[#0b0d12]"}`}>
                        <div className="mb-2 h-14 rounded-lg border border-white/10" style={{ background: `linear-gradient(135deg, ${style.header} 0%, ${style.panel} 100%)` }} />
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-200">{style.label}</span>
                          {selectedCardStyle === style.id && <Check size={14} className="text-violet-200" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#111319] p-4">
                  <div className="mb-4 text-[10px] uppercase tracking-[0.18em] text-zinc-400">Conquistas em destaque</div>
                  <div className="space-y-3">
                    {[
                      { title: "Primeiro Passo", tag: "Conquistada", pct: 100, color: "#34d399" },
                      { title: "Social Dedicado", tag: "Em progresso", pct: 68, color: "#60a5fa" },
                      { title: "Competitivo", tag: "Bloqueada", pct: 0, color: "#7c8599" },
                    ].map((item) => (
                      <div key={item.title} className="rounded-xl border border-white/10 bg-[#0b0d12] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm font-medium text-white"><span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${item.color}22`, color: item.color }}><Crown size={14} /></span> {item.title}</div>
                          <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">{item.tag}</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="mt-3 text-sm text-violet-200">Ver todas</button>
                </div>
              </aside>
            </div>

            {error && <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
            {notice && <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

            <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-6">
              <button className="rounded-xl border border-white/10 bg-white/0 px-4 py-2.5 text-sm text-zinc-200">Cancelar</button>
              <button onClick={saveProfile} disabled={saving} className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(139,92,246,0.35)] disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </main>

          <aside className="hidden xl:block">
            <div className="rounded-[22px] border border-white/10 bg-[#0b0d12]/90 p-4">
              <div className="mb-4 text-[10px] uppercase tracking-[0.18em] text-zinc-400">Admin</div>
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/6 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-sm font-bold">P</div>
                  <div>
                    <div className="text-sm font-semibold text-white">Plano premium</div>
                    <div className="text-[11px] text-violet-300">PRO liberado</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-xs text-zinc-300">
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/0 px-2.5 py-2"><span>Itens da loja</span><span className="text-violet-200">Todos</span></div>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/0 px-2.5 py-2"><span>Banners</span><span className="text-violet-200">Acesso total</span></div>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/0 px-2.5 py-2"><span>Badges</span><span className="text-violet-200">Acesso total</span></div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      {isLoading && <div className="fixed inset-0 z-50 grid place-items-center bg-[#06070b]/80 backdrop-blur-sm"><div className="flex items-center gap-3 rounded-full border border-violet-400/30 bg-violet-500/10 px-5 py-3 text-sm text-violet-100"><div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />Sincronizando perfil…</div></div>}
    </div>
  );
}
