"use client";

import {useAccount} from "wagmi";
import {BRAND} from "@/lib/brand";
import {ADDRESSES} from "@/lib/config";
import {treasuryBuybackAbi} from "@/lib/abis";
import {formatAssetAmount, formatBps, shortAddress} from "@/lib/format";
import {useBuybackState, type BuybackState} from "@/lib/reads";
import {SectionHead} from "./SectionHead";
import {ReadGate} from "./ReadGate";
import {TxButton} from "./TxButton";

/**
 * The treasury buyback, stated in its own terms.
 *
 * The rest of the site makes claims about this: a share of treasury revenue is spent
 * buying the token, what it buys is destroyed, and who may trigger it is the owner's to
 * set. Until this panel existed none of that was checkable from the interface, which made
 * it the one part of the protocol a reader had to take on trust. Every line here is read
 * from the buyback contract.
 */
export function Buyback() {
  const state = useBuybackState();

  return (
    <section>
      <SectionHead eyebrow="Treasury buyback" heading="Revenue spent on the token.">
        A share of what reaches the treasury is spent buying {BRAND.tokenTicker} on the open
        market. Every term below is read from the buyback contract, including who is allowed
        to trigger it — which is a setting, not a constant, and worth seeing rather than
        being told.
      </SectionHead>

      <div className="mt-8">
        <ReadGate
          state={state}
          loadingLabel="Reading the buyback's terms…"
          failureLabel="The buyback could not be read, so none of its terms are shown."
        >
          {(data) => <Terms data={data} />}
        </ReadGate>
      </div>
    </section>
  );
}

const ZERO = "0x0000000000000000000000000000000000000000";

function Terms({data}: {data: BuybackState}) {
  const {address: wallet, isConnected} = useAccount();
  const openToAnyone = data.keeper === ZERO;

  // Mirrors the contract: `canExecute` folds in the keeper and the cooldown, and with no
  // wallet connected there is nobody to ask about.
  const nothingToSpend = data.available === 0n;
  let disabledReason: string | undefined;
  if (!isConnected) disabledReason = undefined; // TxButton says "connect a wallet".
  else if (nothingToSpend) disabledReason = "Nothing has reached the buyback to spend yet.";
  else if (data.callerMayExecute === undefined) {
    disabledReason = "Whether this wallet may trigger it could not be read.";
  } else if (!data.callerMayExecute) {
    disabledReason = openToAnyone
      ? "The cooldown since the last buyback has not elapsed."
      : `Only the named keeper ${shortAddress(data.keeper)} may trigger this buyback.`;
  }

  return (
    <>
      <dl className="card-row grid bg-ink sm:grid-cols-2 lg:grid-cols-4">
        <Term
          cap="bg-seal"
          label="Share of treasury revenue"
          value={formatBps(data.bps)}
          note="Spent on the token each time it runs."
        />
        <Term
          cap="bg-ink"
          label="What it buys"
          value={data.burns ? "Destroyed" : "Sent onward"}
          note={
            data.burns
              ? "Fixed when the contract was constructed. There is no setter and no recipient it could be pointed at."
              : "This deployment does not burn what it buys. Whoever receives it can sell it again."
          }
        />
        <Term
          cap="bg-tint-sky"
          label="Who may trigger it"
          value={openToAnyone ? "Anyone" : "One keeper"}
          note={
            openToAnyone
              ? "No keeper is named, so any address may call it."
              : `Only ${shortAddress(data.keeper)}. The owner can change this.`
          }
        />
        <Term
          cap="bg-tint-mint"
          label="Waiting to be spent"
          value={`${formatAssetAmount(data.available, 18)} ETH`}
          note="Ether and wrapped ether alike, held by the buyback."
          last
        />
      </dl>

      <dl className="mt-6 grid gap-x-8 gap-y-3 border-rule border-ink bg-paperCard p-5 sm:grid-cols-2">
        <Line
          label="Ceiling per call"
          value={
            data.maxSpendPerCall === 0n
              ? "None"
              : `${formatAssetAmount(data.maxSpendPerCall, 18)} ETH`
          }
        />
        <Line
          label="Cooldown between calls"
          value={data.cooldown === 0n ? "None" : `${data.cooldown.toString()} seconds`}
        />
        <Line
          label="Last run"
          value={
            data.lastExecutedAt === 0n
              ? "Never"
              : new Date(Number(data.lastExecutedAt) * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC"
          }
        />
        <Line label="This wallet may trigger it" value={triggerable(data, isConnected, wallet)} />
      </dl>

      <div className="mt-6">
        <TxButton
          address={ADDRESSES.treasuryBuyback}
          abi={treasuryBuybackAbi}
          functionName="execute"
          // A zero floor would accept any fill. The adapter enforces its own, and a caller
          // can only tighten it, so this is the caller's own protection rather than the
          // protocol's -- and it is not this interface's to guess at on somebody's behalf.
          args={[0n, BigInt(Math.floor(Date.now() / 1000) + 600)]}
          label="Run the buyback"
          pendingLabel="Buying…"
          variant="secondary"
          disabledReason={disabledReason}
          confirm={
            <>
              <strong className="block text-ink">This spends treasury revenue.</strong>
              <span className="mt-1 block">
                {formatBps(data.bps)} of what the buyback holds is spent on {BRAND.tokenTicker}
                {data.burns ? " and destroyed" : ""}. This transaction accepts any price the
                route returns above the adapter&apos;s own floor.
              </span>
            </>
          }
        />
      </div>
    </>
  );
}

function triggerable(data: BuybackState, connected: boolean, wallet: string | undefined): string {
  if (!connected || !wallet) return "No wallet connected";
  if (data.callerMayExecute === undefined) return "Could not be read";
  return data.callerMayExecute ? "Yes" : "No";
}

function Term({
  cap,
  label,
  value,
  note,
  last = false,
}: {
  cap: string;
  label: string;
  value: string;
  note: string;
  last?: boolean;
}) {
  return (
    <div
      className={`bg-paperCard ${last ? "" : "border-b-rule border-ink lg:border-b-0 lg:border-r-rule"}`}
    >
      <div aria-hidden className={`tile-cap ${cap}`} />
      <div className="p-5">
        <dt className="rule-label">{label}</dt>
        <dd className="mt-2 font-mono text-xl font-semibold tabular-nums text-ink">{value}</dd>
        <p className="mt-2.5 text-xs leading-relaxed text-inkMuted">{note}</p>
      </div>
    </div>
  );
}

function Line({label, value}: {label: string; value: string}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink/10 pb-2 last:border-b-0">
      <dt className="rule-label">{label}</dt>
      <dd className="font-mono text-sm tabular-nums text-ink">{value}</dd>
    </div>
  );
}
