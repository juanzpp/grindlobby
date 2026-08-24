import { useState } from "react";
import { Check, RotateCcw, Save, X } from "lucide-react";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import { usePlayer } from "@/lib/player-store";
import { findItem } from "@/lib/player-store";
import { STORE_ITEMS } from "@/lib/store-items";
import { getTier } from "@/lib/levels";

const STATUSES: { id: "online" | "ausente" | "ocupado" | "invisivel"; label: string }[] = [
  { id: "online", label: "Online" },
  { id: "ausente", label: "Ausente" },
  { id: "ocupado", label: "Ocupado" },
  { id: "invisivel", label: "Invisível" },
];

export function ProfileSettings({ onClose }: { onClose: () => void }) {
  const { player, update, equip, reset } = usePlayer();
  const [form, setForm] = useState(player);
  const tier = getTier(player.level);

  const ownedBorders = STORE_ITEMS.filter(
    (i) => i.kind === "border" && player.owned.includes(i.id),
  );
  const ownedTitles = STORE_ITEMS.filter(
    (i) => i.kind === "title" && player.owned.includes(i.id),
  );
  const ownedBanners = STORE_ITEMS.filter(
    (i) => i.kind === "banner" && player.owned.includes(i.id),
  );

  function save() {
    update({
      nickname: form.nickname.trim() || "jogador",
      handle: form.handle.trim().replace(/^@/, "") || "jogador",
      bio: form.bio,
      status: form.status,
      region: form.region,
      game: form.game,
      privateProfile: form.privateProfile,
      allowInvites: form.allowInvites,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur-sm">
      <div className="panel max-h-[88vh] w-full max-w-2xl overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">Configurações de perfil</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Level {player.level} • {tier.name} • {player.coins} moedas
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="mt-4 flex items-center gap-4 rounded-xl border border-border p-4"
          style={{ backgroundImage: findItem(player.equipped.banner)?.gradient }}
        >
          <ProfileAvatar name={form.nickname} size={64} borderId={player.equipped.border} />
          <div>
            <p className="flex items-center gap-2 font-display text-lg font-bold">
              {form.nickname}
              {findItem(player.equipped.title)?.label && (
                <span className="rounded border border-primary/50 bg-primary/15 px-1.5 text-[10px] font-bold text-primary-glow">
                  {findItem(player.equipped.title)?.label}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">@{form.handle}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label-caps">Nick</span>
            <input
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-input bg-panel px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </label>
          <label className="block">
            <span className="label-caps">Usuário</span>
            <input
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-input bg-panel px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label-caps">Bio</span>
            <textarea
              value={form.bio}
              rows={2}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="mt-1.5 w-full resize-none rounded-lg border border-input bg-panel px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </label>
          <label className="block">
            <span className="label-caps">Região</span>
            <select
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-input bg-panel px-3 py-2 text-sm outline-none focus:border-ring"
            >
              {["BR-Sul", "BR-Sudeste", "BR-Nordeste", "LATAM", "NA-Leste"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-caps">Jogo principal</span>
            <select
              value={form.game}
              onChange={(e) => setForm({ ...form, game: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-input bg-panel px-3 py-2 text-sm outline-none focus:border-ring"
            >
              {["EA FC 27", "Valorant", "CS2", "Rocket League", "Fortnite"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4">
          <p className="label-caps">Status</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => setForm({ ...form, status: s.id })}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  form.status === s.id
                    ? "border border-primary/50 bg-primary/20"
                    : "border border-border bg-panel text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {[
            { key: "privateProfile" as const, label: "Perfil privado" },
            { key: "allowInvites" as const, label: "Permitir convites de lobby" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setForm({ ...form, [t.key]: !form[t.key] })}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-panel px-3 py-2.5 text-sm"
            >
              {t.label}
              <span
                className={`relative h-5 w-9 rounded-full transition-colors ${
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
        </div>

        <div className="mt-5 space-y-4">
          {[
            { title: "Borda equipada", list: ownedBorders, slot: "border" as const },
            { title: "Título equipado", list: ownedTitles, slot: "title" as const },
            { title: "Banner equipado", list: ownedBanners, slot: "banner" as const },
          ].map((group) => (
            <div key={group.slot}>
              <p className="label-caps">{group.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.list.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => equip(item)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      player.equipped[group.slot] === item.id
                        ? "border border-success/50 bg-success/15 text-success"
                        : "border border-border bg-panel text-muted-foreground"
                    }`}
                  >
                    {player.equipped[group.slot] === item.id && (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={reset}
            className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <RotateCcw className="h-4 w-4" /> Resetar conta (level 0)
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
  );
}
