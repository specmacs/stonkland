import {BRAND, LEVELS, type LevelInfo} from "@/lib/brand";
import {PieceArt} from "./PieceArt";
import {Stars} from "./SectionHead";

/**
 * The header colour for each level.
 *
 * Four pastels and then the stamp. The jump in kind at the top is the point: a Landmark
 * is not one more step along a gradient, it is the end of the ladder, and the row should
 * say so before the numbers under it are read.
 */
const HEADER: Record<number, {bar: string; type: string; field: string}> = {
  1: {bar: "bg-tint-mint", type: "text-ink", field: "bg-tint-mint/35"},
  2: {bar: "bg-tint-sky", type: "text-ink", field: "bg-tint-sky/35"},
  3: {bar: "bg-tint-sun", type: "text-ink", field: "bg-tint-sun/35"},
  4: {bar: "bg-tint-peach", type: "text-ink", field: "bg-tint-peach/35"},
  5: {bar: "bg-seal", type: "text-paperCard", field: "bg-seal/10"},
};

/** The five forms as a row of cards, lifted off the page as one block. */
export function LevelCards() {
  return (
    <div className="card-row grid bg-ink sm:grid-cols-2 lg:grid-cols-5">
      {LEVELS.map((l) => (
        <LevelCard key={l.level} level={l} />
      ))}
    </div>
  );
}

function LevelCard({level: l}: {level: LevelInfo}) {
  const head = HEADER[l.level] ?? HEADER[1]!;
  const mint = l.level === 1;
  return (
    <article className="flex flex-col bg-paperCard [&:not(:last-child)]:border-b-rule [&:not(:last-child)]:border-ink lg:[&:not(:last-child)]:border-b-0 lg:[&:not(:last-child)]:border-r-rule">
      <header
        className={`flex items-baseline justify-between gap-2 border-b-rule border-ink px-4 py-3 ${head.bar} ${head.type}`}
      >
        <span className="font-display text-lg font-bold leading-none">{l.form}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-70">
          Lv {l.level}
        </span>
      </header>

      <div className={`flex grow flex-col items-center px-4 pb-5 pt-5 ${head.field}`}>
        <PieceArt level={l.level} className="h-32 w-32" />
        <Stars level={l.level} className="mt-4" />
      </div>

      <dl className="border-t-rule border-ink/15 px-4 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="rule-label">{BRAND.scoreTerm}</dt>
          <dd className="font-mono text-2xl font-semibold tabular-nums text-seal">
            {l.weight}
          </dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-ink/10 pt-2">
          <dt className="rule-label">{mint ? "Mint burn" : "Burn to reach"}</dt>
          <dd className="font-mono text-sm tabular-nums text-ink">
            {short(l.burnToReach)}
          </dd>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <dt className="rule-label">Burned in total</dt>
          <dd className="font-mono text-sm tabular-nums text-inkMuted">
            {short(l.cumulativeBurn)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

/** Whole-token figures at card size. The exact figures are in the ladder table. */
function short(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  return `${tokens / 1_000}k`;
}
