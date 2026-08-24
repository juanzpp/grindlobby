import { findItem } from "@/lib/player-store";

type Props = {
  name: string;
  size?: number;
  borderId?: string;
  /** data URL / URL da foto de perfil escolhida pelo usuário */
  avatarUrl?: string;
  className?: string;
};

/** Avatar com moldura equipável (item da loja) e foto opcional. */
export function ProfileAvatar({
  name,
  size = 36,
  borderId,
  avatarUrl,
  className = "",
}: Props) {
  const border = borderId ? findItem(borderId) : undefined;
  const ring = border?.ring ?? "oklch(0.32 0.02 285)";
  const pad = size >= 60 ? 4 : 3;

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center rounded-full ${
        border?.animated ? "animate-border-spin" : ""
      } ${className}`}
      style={{
        width: size,
        height: size,
        padding: pad,
        background: ring,
        boxShadow: border?.shadow ?? "none",
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`Foto de perfil de ${name}`}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-primary/70 to-primary-glow/70 font-display font-bold text-primary-foreground"
          style={{ fontSize: Math.max(10, size * 0.36) }}
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
