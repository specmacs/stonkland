import Image from "next/image";
import {formName} from "@/lib/brand";
import {pieceAlt, pieceWebPath} from "@/lib/pieces";

/**
 * A level's piece, framed rather than floated.
 *
 * The renders carry their own vignetted night backdrop, so there is no clean key and
 * nothing to float on a coloured field. Filling the panel edge to edge is the honest
 * reading of that: the art becomes the card's image panel, bounded by the same ink rule
 * as everything else, and no seam has to be hidden. They are square and so are the
 * panels, so `object-cover` crops nothing.
 *
 * Where a render does not exist it shows a marked placeholder rather than a substitute
 * drawing -- an empty state stays empty here as everywhere else.
 */
export function PieceArt({
  level,
  className = "",
  priority = false,
}: {
  level: number;
  className?: string;
  /** Set on the one piece above the fold, so it is not lazy-loaded into a layout shift. */
  priority?: boolean;
}) {
  const src = pieceWebPath(level);

  if (!src) return <PiecePending level={level} className={className} />;

  return (
    <span className={`relative block overflow-hidden bg-field-night ${className}`}>
      <Image
        src={src}
        alt={pieceAlt(level)}
        fill
        sizes="(max-width: 640px) 60vw, 320px"
        priority={priority}
        className="object-cover"
      />
    </span>
  );
}

/** Says what is missing, in the piece's own footprint, so the row keeps its rhythm. */
function PiecePending({level, className = ""}: {level: number; className?: string}) {
  return (
    <span
      className={`flex flex-col items-center justify-center border-rule border-dashed border-ink/30 bg-tint-cream text-center ${className}`}
      role="img"
      aria-label={`${formName(level)}, level ${level}. Render in production.`}
    >
      <span className="font-display text-base font-bold leading-tight text-ink/70">
        {formName(level)}
      </span>
      <span className="mt-1 px-2 font-mono text-[9px] uppercase leading-tight tracking-[0.12em] text-inkFaint">
        Render in production
      </span>
    </span>
  );
}
