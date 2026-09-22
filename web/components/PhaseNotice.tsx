import {BRAND, EDITION} from "@/lib/brand";
import {LAUNCH_PHASE} from "@/lib/config";

/**
 * Says where the launch is, because the two phases behave differently and somebody
 * arriving mid-curve should not have to work that out from a disabled button.
 *
 * Nothing about the cards changes between phases. Minting, building, transferring and
 * claiming all work throughout. What changes is where the token trades and whether the
 * treasury has anything to buy it back against.
 */
export function PhaseNotice({className = ""}: {className?: string}) {
  // Only "curve" has anything to say, and only when somebody has actually said it. An
  // unset variable means nobody has, and the honest response to that is nothing at all.
  if (LAUNCH_PHASE !== "curve") return null;

  return (
    <aside
      className={`border-rule border-ink bg-paperCard shadow-card ${className}`}
      aria-label="Launch phase"
    >
      <p className="border-b-rule border-ink bg-seal px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-paperCard">
        Where the launch is
      </p>
      <div className="px-5 py-5">
        <p className="text-body-lg leading-relaxed text-ink">
          {BRAND.tokenTicker} is still on its bonding curve. It trades against the curve
          rather than a pool, and the curve has to be bought out before a pool exists.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-inkMuted">
          Everything about the cards works now and works the same afterwards: minting,
          building, transferring, and claiming whatever a {BRAND.groupTerm.toLowerCase()}{" "}
          has received. The {EDITION.buybackBps / 100}% treasury buyback is the one part that
          waits, because until a pool exists there is nothing to buy the token against. It
          holds the money rather than spending it badly.
        </p>
        <p className="mt-4 border-t border-ink/10 pt-3 font-mono text-[11px] leading-relaxed text-inkFaint">
          Set in this deployment&apos;s configuration, not read from chain. It is stated
          rather than inferred: the interface could guess from whether a pool address is
          present, and a wrong guess would tell you the launch had reached a stage it had
          not. When nobody has set it, nothing appears here.
        </p>
      </div>
    </aside>
  );
}
