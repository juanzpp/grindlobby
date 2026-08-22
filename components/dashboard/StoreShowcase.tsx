"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Check, ChevronRight, Crown, Frame, Gift, Image as ImageIcon, MessageSquare, Package, Palette, SignalHigh, Sparkles, Star, Wand2, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ProfileAvatar } from "@/components/dashboard/LovableWidgets";
import SmokeFX from "@/components/SmokeFX";
import { DEFAULT_PROFILE_COSMETICS, equipBundle, equipCosmetic, normalizeCosmeticState } from "@/lib/cosmetic-state";
import { BUNDLES, SHELVES, STORE_CATEGORIES, type Bundle, type CosmeticKind, type ShelfItem, type StoreCategory } from "@/lib/store-catalog";

type StoreShowcaseProps = { display: string; isAdmin?: boolean };

const kindIcon: Record<CosmeticKind, LucideIcon> = {
  Moldura: Frame,
  Banner: MessageSquare,
  "Papel de parede": ImageIcon,
  "Badge de perfil": Shield,
  "Cor do chat": Palette,
  "Efeito de lobby": Sparkles,
};

function rgba(color: string, alpha: number) { return color.replace(")", ` / ${alpha})`); }

function BundleArt({ bundle, big = false }: { bundle: Bundle; big?: boolean }) {
  return <div className={`gl-store-art ${big ? "gl-store-art-big" : ""}`} style={{ background: `radial-gradient(80% 100% at 50% 100%, ${rgba(bundle.accent, .35)}, transparent 70%), linear-gradient(160deg, oklch(.12 .03 290), oklch(.05 .01 285))` }}>
    <div className="gl-store-art-pulse" style={{ background: `radial-gradient(60% 100% at 50% 100%, ${bundle.glow}, transparent 72%)` }} />
    <span className="gl-store-art-logo">GL</span>
    {[-1, 1].map((side) => <span key={side} className="gl-store-art-beam" style={{ left: `${50 + side * 22}%`, background: `linear-gradient(180deg, transparent, ${bundle.glow}, transparent)` }} />)}
  </div>;
}

function MiniAvatar({ name }: { name: string }) { return <ProfileAvatar name={name} size={30} />; }

function Shelf({ title, items, onEquip }: { title: string; items: ShelfItem[]; onEquip: (id: string) => void }) {
  return <section className="gl-store-panel gl-store-shelf"><header><span className="gl-store-label">{title}</span><button onClick={() => items[0] && onEquip(items[0].id)}>Ver todos <ChevronRight size={13} /></button></header>{items.length ? <ul>{items.map((item) => { const Icon = kindIcon[item.kind]; return <li key={item.id}><span className="gl-store-shelf-icon" style={{ background: `radial-gradient(70% 70% at 50% 100%, ${rgba(item.accent, .45)}, oklch(.1 .02 288))`, boxShadow: `0 0 14px ${rgba(item.accent, .3)}` }}><Icon size={15} /></span><span className="gl-store-shelf-copy"><strong>{item.name}</strong><small>{item.kind}</small></span><button onClick={() => onEquip(item.id)}>Equipar</button></li>; })}</ul> : <p className="gl-store-empty">Nenhum item nesta categoria.</p>}</section>;
}

export default function StoreShowcase({ display, isAdmin = false }: StoreShowcaseProps) {
  const [category, setCategory] = useState<StoreCategory>("Bundles");
  const [selected, setSelected] = useState("competitive");
  const [storedCosmeticState, setStoredCosmeticState] = useState(DEFAULT_PROFILE_COSMETICS);
  const cosmeticState = useMemo(() => normalizeCosmeticState(storedCosmeticState, isAdmin), [storedCosmeticState, isAdmin]);
  const bundle = useMemo(() => BUNDLES.find((item) => item.id === selected) ?? BUNDLES[0], [selected]);
  const filteredShelves = useMemo(() => SHELVES.map((shelf) => ({ ...shelf, items: shelf.items.filter((item) => category === "Bundles" ? true : category === "Molduras" ? item.kind === "Moldura" : category === "Banners" ? item.kind === "Banner" : category === "Papéis de parede" ? item.kind === "Papel de parede" : item.kind === "Efeito de lobby" || item.kind === "Badge de perfil") })), [category]);

  const updateCosmetic = (kind: "banner" | "frame" | "effect" | "badge" | "cardStyle", id: string) => {
    const state = equipCosmetic(cosmeticState, kind, id, isAdmin);
    setStoredCosmeticState(state);
  };

  const equipBundleSelection = (bundleId: string) => {
    const state = equipBundle(cosmeticState, bundleId, isAdmin);
    setSelected(bundleId);
    setStoredCosmeticState(state);
  };

  const equipped = cosmeticState.equipped.bundle || null;

  return <section className="gl-store-showcase">
    <aside className="gl-store-sidebar"><div className="gl-store-brand"><span>GL</span><strong>GRIND<span>LOBBY</span></strong></div><nav>{["Dashboard", "Lobbies", "Rank", "Loja", "Pro", "Configurações"].map((item) => <button key={item} className={item === "Loja" ? "is-active" : ""}>{item}</button>)}</nav><div className="gl-store-sidebar-actions"><button><Sparkles size={14} />Criar lobby</button><button><Gift size={14} />Convidar amigos</button></div><div className="gl-store-activity"><span className="gl-store-label">Atividade recente</span><p><MiniAvatar name="Maya" /> Maya está online</p><p><MiniAvatar name="Ravi" /> Ravi entrou no lobby</p></div></aside>
    <main className="gl-store-main"><header className="gl-store-header"><div><Crown size={16} /><strong>{isAdmin ? "Admin ativo" : "Plano Free"}</strong><i /> <span>{isAdmin ? "PRO liberado gratuitamente" : "Personalize seu perfil"}</span></div><div><Gift size={18} /><span className="gl-store-notification"><SignalHigh size={18} /></span></div></header>
      <div className="gl-store-content"><div className="gl-store-column"><h1>Loja de Cosméticos</h1><p className="gl-store-subtitle">Personalize seu perfil e destaque-se no GrindLobby.</p><div className="gl-store-tabs">{STORE_CATEGORIES.map((item) => { const Icon = item === "Bundles" ? Package : item === "Molduras" ? Frame : item === "Banners" ? MessageSquare : item === "Papéis de parede" ? ImageIcon : item === "Efeitos" ? Wand2 : Star; return <button key={item} onClick={() => setCategory(item)} className={category === item ? "is-active" : ""}><Icon size={14} />{item}</button>; })}</div>
        <section className="gl-store-hero"><Image src="/lovable/store-bundles.jpg" alt="Caixa de cosméticos GrindLobby envolta em névoa violeta" fill priority /><div className="gl-store-hero-shade" /><SmokeFX originX={72} /><div className="gl-store-hero-copy"><h2>Coleções exclusivas para<br />representar seu estilo.</h2><p>Todos os itens disponíveis para admins.</p></div></section>
        {category === "Bundles" ? <><div className="gl-store-section-heading"><span><Crown size={14} />Bundles em destaque</span><small>5 coleções</small></div><div className="gl-store-bundles">{BUNDLES.map((item) => <article key={item.id} onClick={() => setSelected(item.id)} className={selected === item.id ? "is-selected" : ""} style={selected === item.id ? { boxShadow: `0 0 26px ${rgba(item.glow, .35)}` } : undefined}><span className="gl-store-check">{selected === item.id && <Check size={12} />}</span><BundleArt bundle={item} /><h3>{item.name}</h3><p>6 itens inclusos</p><ul>{item.items.map((included) => { const Icon = kindIcon[included.kind]; return <li key={included.kind}><Icon size={12} />{included.kind}</li>; })}</ul><em>Liberado</em><button onClick={(event) => { event.stopPropagation(); equipBundleSelection(item.id); }} className={equipped === item.id ? "is-equipped" : ""}>{equipped === item.id ? "Equipado" : "Equipar"}</button></article>)}</div></> : null}
        <div className="gl-store-shelves">{filteredShelves.map((shelf) => <Shelf key={shelf.title} title={shelf.title} items={shelf.items} onEquip={(id) => updateCosmetic("banner", id)} />)}</div>
      </div><aside className="gl-store-preview gl-store-panel"><span className="gl-store-label">Pré-visualização</span><BundleArt bundle={bundle} big /><div className="gl-store-frame" style={{ borderColor: bundle.glow, boxShadow: `inset 0 0 18px ${rgba(bundle.glow, .5)}, 0 0 20px ${rgba(bundle.glow, .35)}` }}><MiniAvatar name={display} /><div><strong>{display}</strong><small>@{display.toLowerCase().replace(/\s+/g, "_")} · ADMIN</small></div></div><div className="gl-store-preview-icons">{bundle.items.map((item) => { const Icon = kindIcon[item.kind]; return <span key={item.kind} title={item.kind}><Icon size={15} /></span>; })}</div><h2>Itens inclusos</h2><ul className="gl-store-included">{bundle.items.map((item) => <li key={item.kind}><span><Check size={12} /></span><div><strong>{item.name}</strong><small>{item.kind}</small></div><em>Liberado</em></li>)}</ul><button className="gl-store-equip" onClick={() => equipBundleSelection(bundle.id)}>{equipped === bundle.id ? "Bundle equipado" : "Equipar bundle"}</button></aside></div>
    </main>
  </section>;
}
