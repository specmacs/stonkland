import {BRAND, LEVELS} from "@/lib/brand";
import {levelStyle} from "@/lib/levelStyle";
import {PieceArt} from "./PieceArt";
import {Stars} from "./SectionHead";

/**
 * What weight actually does, shown rather than asserted.
 *
 * This is the one idea the whole game rests on and the hardest to get across in a
 * sentence, so it gets a picture: two cards in the same district, the same deposit
 * arriving, and the split that follows. The weights are the argument, so they are set at
 * display size; the percentages under them are the same fact restated for anyone who
 * reads ratios more easily as shares.
 *
 * There is no rate here, no projection and no currency amount. The point being made is
 * about proportion, and the footer says so in the only number that is really being
 * claimed.
 */
export function WeightComparison() {
  const house = LEVELS[0];
  const landmark = LEVELS[4];
  if (!house || !landmark) return null;

  const total = house.weight + landmark.weight;
  const ratio = landmark.weight / house.weight;

  return (
    <div className="border-rule border-ink bg-paperCard shadow-cardLg">
      <div className="border-b-rule border-ink bg-ink px-6 py-3.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-field-sun">
          If these two cards shared one {BRAND.groupTerm.toLowerCase()}
        </p>
      </div>

      <div className="grid sm:grid-cols-2">
        <Side
          level={house.level}
          form={house.form}
          weight={house.weight}
          share={(house.weight / total) * 100}
          note="One burn. The cheapest place on the board."
        />
        <div className="border-t-rule border-ink sm:border-l-rule sm:border-t-0">
          <Side
            level={landmark.level}
            form={landmark.form}
            weight={landmark.weight}
            share={(landmark.weight / total) * 100}
            note={`${landmark.cumulativeBurn.toLocaleString("en-US")} ${BRAND.tokenTicker} destroyed to get here.`}
          />
        </div>
      </div>

      {/* The one number actually being claimed. */}
      <div className="flex items-center justify-between gap-4 border-y-rule border-ink bg-seal px-6 py-4">
        <p className="font-display text-2xl font-bold uppercase leading-none tracking-tight text-paperCard">
          {ratio}× weight
        </p>
        <p className="font-mono text-xs tabular-nums text-paperCard/80">
          {landmark.weight} ÷ {house.weight}
        </p>
      </div>

      <div className="px-6 py-6">
        <p className="text-sm leading-relaxed text-inkMuted">
          The {landmark.form} takes {ratio} times the {house.form}&apos;s share of the same
          deposit, because its weight is {ratio} times larger. That is the whole of the
          relationship.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-inkMuted">
          It says nothing about how much arrives. Five times a small number is a small
          number, and five times nothing is nothing.
        </p>
      </div>
    </div>
  );
}

function Side({
  level,
  form,
  weight,
  share,
  note,
}: {
  level: number;
  form: string;
  weight: number;
  share: number;
  note: string;
}) {
  const style = levelStyle(level);
  return (
    <div className={`flex h-full flex-col px-6 py-7 ${style.field}`}>
      <PieceArt level={level} className="mx-auto h-28 w-28" />
      <Stars level={level} size="sm" className="mx-auto mt-4" />

      <p className="mt-5 text-center font-mono text-[3.25rem] font-semibold leading-none tabular-nums text-ink">
        {weight}
      </p>
      <p className="mt-2 text-center font-display text-xl font-bold leading-none text-ink">
        {form}
      </p>
      <p className="rule-label mt-1.5 text-center">{BRAND.scoreTerm}</p>

      <div className="mt-6 border-t border-ink/15 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="rule-label">Of that deposit</span>
          <span className="font-mono text-lg font-semibold tabular-nums text-seal">
            {share.toFixed(share % 1 === 0 ? 0 : 1)}%
          </span>
        </div>
        <div
          className="mt-2.5 h-3 w-full overflow-hidden border-rule border-ink bg-paperCard"
          role="img"
          aria-label={`${form} takes ${share.toFixed(1)} percent`}
        >
          <div className="h-full bg-ink" style={{width: `${share}%`}} />
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-inkMuted">{note}</p>
    </div>
  );
}
