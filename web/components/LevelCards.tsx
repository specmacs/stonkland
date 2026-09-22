import {BRAND, LEVELS, type LevelInfo} from "@/lib/brand";
import {boardRule, levelStyle, shortTokens} from "@/lib/levelStyle";
import {PieceArt} from "./PieceArt";
import {Stars} from "./SectionHead";

/**
 * The five forms as a row of cards, lifted off the page as one block.
 *
 * Each card is headed in its own colour, taken from the same record the rotating hero
 * card reads, so a Tower is the same orange wherever it appears. On a phone the five
 * stack into one column and each header band becomes a full-width marker you can find
 * your place by while scrolling.
 */
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
  const style = levelStyle(l.level);
  return (
    <article className="flex flex-col bg-paperCard [&:not(:last-child)]:border-b-rule [&:not(:last-child)]:border-ink sm:[&:nth-child(-n+4)]:border-b-rule sm:[&:nth-child(odd)]:border-r-rule sm:[&:nth-child(odd)]:border-ink lg:[&:not(:last-child)]:border-b-0 lg:[&:nth-child(-n+4)]:border-b-0 lg:[&:not(:last-child)]:border-r-rule lg:[&:not(:last-child)]:border-ink">
      <header
        className={`flex items-center justify-between gap-2 border-b-rule border-ink px-4 py-3 text-paperCard ${style.bar}`}
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
          Level {l.level}
        </span>
        <span className={`font-mono text-sm font-semibold tabular-nums ${style.accent}`}>
          {String(l.level).padStart(2, "0")}
        </span>
      </header>

      <div className={`flex grow flex-col items-center px-4 pb-5 pt-6 ${style.field}`}>
        <PieceArt level={l.level} className="h-36 w-36" />
        <h3 className="mt-5 font-display text-xl font-bold leading-none text-ink">{l.form}</h3>
        <Stars level={l.level} size="sm" className="mt-2.5" />
      </div>

      <dl className="border-t-rule border-ink px-4 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="rule-label">{BRAND.scoreTerm}</dt>
          <dd className="font-mono text-2xl font-semibold tabular-nums text-seal">
            {l.weight}
          </dd>
        </div>
        <div className="mt-2.5 flex items-baseline justify-between gap-2 border-t border-ink/10 pt-2.5">
          <dt className="rule-label">Board rule</dt>
          <dd className="font-mono text-sm tabular-nums text-ink">
            {boardRule(l.level, l.burnToReach)}
          </dd>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <dt className="rule-label">Burned in total</dt>
          <dd className="font-mono text-sm tabular-nums text-inkMuted">
            {shortTokens(l.cumulativeBurn)}
          </dd>
        </div>
      </dl>
    </article>
  );
}
