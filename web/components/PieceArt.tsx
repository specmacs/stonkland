import Image from "next/image";
import {formName} from "@/lib/brand";
import {pieceAlt, pieceWebPath} from "@/lib/pieces";

/**
 * A level's piece.
 *
 * Shows the commissioned render where one exists. Where one does not, it shows a marked
 * placeholder rather than falling back to the flat drawing: mixing a vector sketch into a
 * row of photographic renders reads as a broken image, while a plate that says what is
 * missing reads as a decision. The same instinct as everywhere else here -- an empty
 * state stays empty rather than being dressed up.
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
        sizes="(max-width: 640px) 40vw, 320px"
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
