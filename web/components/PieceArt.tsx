import Image from "next/image";
import {formName} from "@/lib/brand";
import {pieceAlt, pieceWebPath} from "@/lib/pieces";

/**
 * A level's piece.
 *
 * The renders are transparent cut-outs, so the piece sits on whatever field the caller
 * puts it on and the level's own tint shows through around it. They are already squared
 * and share a ground line, so `object-contain` in a square box needs no further
 * alignment: the five stand on one floor wherever they appear together.
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
    <span className={`relative block ${className}`}>
      <Image
        src={src}
        alt={pieceAlt(level)}
        fill
        sizes="(max-width: 640px) 60vw, 320px"
        priority={priority}
        className="object-contain"
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
