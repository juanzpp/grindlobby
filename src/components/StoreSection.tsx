import { useState } from "react";
import { Check, Coins, Lock, ShoppingCart, Zap } from "lucide-react";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import { usePlayer } from "@/lib/player-store";
import { STORE_ITEMS, STORE_TABS, type StoreItem, type StoreItemKind } from "@/lib/store-items";

function Preview({ item, nickname }: { item: StoreItem; nickname: string }) {
  if (item.kind === "border") {
    return (
      <div className="grid h-24 place-items-center rounded-lg bg-panel/70">
        <ProfileAvatar name={nickname} size={62} borderId={item.id} />
      </div>
    );
  }
  if (item.kind === "banner") {
    return (
      <div
        className="grid h-24 place-items-end rounded-lg p-2"
        style={{ backgroundImage: item.gradient }}
      >
        <span className="text-[11px] font-semibold text-foreground/80">{nickname}</span>
      </div>
    );
  }
  if (item.kind === "title") {
    return (
      <div className="grid h-24 place-items-center rounded-lg bg-panel/70">
        {item.label ? (
          <span className="rounded-md border border-primary/50 bg-primary/15 px-2.5 py-1 font-display text-xs font-bold tracking-wide text-primary-glow">
            {item.label}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">nenhum</span>
        )}
      </div>
    );
  }
  return (
    <div className="grid h-24 place-items-center rounded-lg bg-panel/70">
      <Zap className="h-9 w-9 text-warning" />
    </div>
  );
}

export function StoreSection() {
  const { player, buy, equip, update, addXp } = usePlayer();
  const [tab, setTab] = useState<StoreItemKind>("border");
  const [msg, setMsg] = useState<string | null>(null);

  const items = STORE_ITEMS.filter((i) => i.kind === tab);

  function handleBuy(item: StoreItem) {
    if (item.kind === "boost") {
      if (player.level < item.minLevel) return setMsg(`Requer level ${item.minLevel}`);
      if (player.coins < item.price) return setMsg("Moedas insuficientes");
      update({ coins: player.coins - item.price });
      addXp(item.id === "boost-xp-mega" ? 2000 : 500);
      return setMsg(`${item.name} aplicado!`);
    }
    const res = buy(item);
    setMsg(res.ok ? `${item.name} comprado e equipado` : (res.reason ?? "Não foi possível"));
    return undefined;
  }

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label-caps">Loja — personalização de perfil</p>
        <span className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1 text-sm font-semibold">
          <Coins className="h-4 w-4 text-warning" /> {player.coins}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {STORE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "border border-primary/50 bg-primary/20 text-foreground"
                : "border border-border bg-panel text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <p className="mt-3 text-xs text-primary-glow">{msg}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const owned = player.owned.includes(item.id);
          const equipped =
            player.equipped.border === item.id ||
            player.equipped.title === item.id ||
            player.equipped.banner === item.id;
          const locked = player.level < item.minLevel;

          return (
            <article
              key={item.id}
              className="overflow-hidden rounded-xl border border-border bg-panel/50 p-3"
            >
              <Preview item={item} nickname={player.nickname} />
              <h3 className="mt-3 text-sm font-semibold">{item.name}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  {item.price === 0 ? (
                    "Grátis"
                  ) : (
                    <>
                      <Coins className="h-3.5 w-3.5 text-warning" /> {item.price}
                    </>
                  )}
                </p>
                {locked ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> Lv {item.minLevel}
                  </span>
                ) : equipped ? (
                  <span className="flex items-center gap-1.5 rounded-md border border-success/40 bg-success/15 px-2 py-1 text-xs font-semibold text-success">
                    <Check className="h-3.5 w-3.5" /> Equipado
                  </span>
                ) : owned ? (
                  <button
                    onClick={() => equip(item)}
                    className="btn-ghost rounded-md px-2.5 py-1.5 text-xs font-semibold"
                  >
                    Equipar
                  </button>
                ) : (
                  <button
                    onClick={() => handleBuy(item)}
                    className="btn-primary flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" /> Comprar
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
