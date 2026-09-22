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
  if (LAUNCH_PHASE === "graduated") return null;

  return (
    <aside
      className={`panel border-seal p-5 ${className}`}
      aria-label="Launch phase"
    >
      <p className="rule-label">Where the launch is</p>
      <p className="mt-2 text-sm leading-relaxed text-ink">
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
    </aside>
  );
}
