import {BRAND, LEVELS} from "@/lib/brand";
import {PieceArt} from "./PieceArt";

/**
 * What weight actually does, shown rather than asserted.
 *
 * This is the one idea the whole game rests on and the hardest to get across in a
 * sentence, so it gets a picture: two cards in the same quarter, the same deposit
 * arriving, and the split that follows. The bars are the ratio of the two weights and
 * nothing else — there is no rate here, no projection, and no currency amount, because
 * the point being made is about proportion.
 */
export function WeightComparison() {
  const house = LEVELS[0];
  const landmark = LEVELS[4];
  if (!house || !landmark) return null;

  const total = house.weight + landmark.weight;
  const housePct = (house.weight / total) * 100;
  const landmarkPct = (landmark.weight / total) * 100;

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-ink-800 px-6 py-4">
        <p className="rule-label">If these two cards shared one {BRAND.groupTerm.toLowerCase()}</p>
      </div>

      <div className="grid sm:grid-cols-2">
        <Side
          level={house.level}
          form={house.form}
          weight={house.weight}
          share={housePct}
          note="One burn. The cheapest place on the board."
        />
        <div className="border-t border-ink-800 sm:border-l sm:border-t-0">
          <Side
            level={landmark.level}
            form={landmark.form}
            weight={landmark.weight}
            share={landmarkPct}
            note={`${landmark.cumulativeBurn.toLocaleString("en-US")} ${BRAND.tokenTicker} destroyed to get here.`}
            emphasis
          />
        </div>
      </div>

      <div className="border-t border-ink-800 px-6 py-5">
        <p className="text-sm leading-relaxed text-ink-300">
          The {landmark.form} takes {landmark.weight / house.weight} times the{" "}
          {house.form}&apos;s share of the same deposit, because its weight is{" "}
          {landmark.weight / house.weight} times larger. That is the whole of the
          relationship.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
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
  emphasis = false,
}: {
  level: number;
  form: string;
  weight: number;
  share: number;
  note: string;
  emphasis?: boolean;
}) {
  return (
    <div className="px-6 py-6">
      <div className="flex items-center gap-4">
        <PieceArt level={level} className="h-16 w-16 shrink-0" />
        <div>
          <p className="text-sm font-medium text-ink-100">{form}</p>
          <p className="rule-label mt-1">
            {BRAND.scoreTerm} {weight}
          </p>
        </div>
      </div>

      <p className="figure mt-5">
        {share.toFixed(share % 1 === 0 ? 0 : 1)}
        <span className="ml-1 font-sans text-lg text-ink-500">%</span>
      </p>
      <p className="rule-label mt-1.5">of that deposit</p>

      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink-800"
        role="img"
        aria-label={`${form} takes ${share.toFixed(1)} percent`}
      >
        <div
          className={`h-full rounded-full ${emphasis ? "bg-brass-500" : "bg-ink-600"}`}
          style={{width: `${share}%`}}
        />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-500">{note}</p>
    </div>
  );
}
