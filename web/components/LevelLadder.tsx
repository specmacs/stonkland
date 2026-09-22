import {BRAND, LEVELS} from "@/lib/brand";

/** The level schedule, exactly as the contracts compute it. */
export function LevelLadder({showCumulative = true}: {showCumulative?: boolean}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">
          The five forms, their {BRAND.scoreTerm}, and what each costs to reach
        </caption>
        <thead>
          <tr className="border-b-rule border-ink text-left">
            <th scope="col" className="rule-label py-3 pr-4 font-normal">Level</th>
            <th scope="col" className="rule-label py-3 pr-4 font-normal">Form</th>
            <th scope="col" className="rule-label py-3 pr-4 text-right font-normal">
              {BRAND.scoreTerm}
            </th>
            <th scope="col" className="rule-label py-3 pr-4 text-right font-normal">
              Burn to reach
            </th>
            {showCumulative && (
              <th scope="col" className="rule-label py-3 text-right font-normal">
                Cumulative
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((l) => (
            <tr key={l.level} className="border-b-rule border-ink/20">
              <td className="py-3 pr-4 font-mono text-inkMuted">{l.level}</td>
              <td className="py-3 pr-4 text-ink">{l.form}</td>
              <td className="py-3 pr-4 text-right font-mono text-seal">{l.weight}</td>
              <td className="py-3 pr-4 text-right font-mono text-inkMuted">
                {l.level === 1 ? (
                  <span className="text-inkMuted">{l.burnToReach.toLocaleString("en-US")} (mint)</span>
                ) : (
                  l.burnToReach.toLocaleString("en-US")
                )}
              </td>
              {showCumulative && (
                <td className="py-3 text-right font-mono text-inkMuted">
                  {l.cumulativeBurn.toLocaleString("en-US")}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
