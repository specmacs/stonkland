"use client";

import {useAccount} from "wagmi";
import {BRAND, QUARTERS} from "@/lib/brand";
import {ADDRESSES, EDITION_ID} from "@/lib/config";
import {distributorAbi} from "@/lib/abis";
import {formatAssetAmount, formatShare} from "@/lib/format";
import {
  useOwnedCards,
  useQuarterStandings,
  useRewardAssets,
  type QuarterStanding,
  type RewardAssetInfo,
} from "@/lib/reads";
import {PageHeader} from "./Section";
import {ReadGate} from "./ReadGate";
import {TxButton} from "./TxButton";
import {NonAffiliation} from "./Disclaimer";

export function GroundRent() {
  const {isConnected} = useAccount();
  const standings = useQuarterStandings();
  const assets = useRewardAssets();
  const owned = useOwnedCards();

  return (
    <>
      <PageHeader
        eyebrow="Your share of what arrived"
        heading={`Collect ${BRAND.rewardsPageTerm.toLowerCase()}.`}
        sub={`Rewards are pushed out to card owners, so you are not required to do anything to be paid. The claim below is a backstop, not a chore: it exists so that being paid never depends on anybody else running anything.`}
        tone="cream"
      />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6">
        {!isConnected ? (
          <div className="border-rule border-ink bg-paperCard px-6 py-16 text-center shadow-cardLg">
            <p className="font-display text-2xl font-bold text-ink">
              Connect a wallet to open your scoreboard.
            </p>
            <p className="mt-3 text-sm text-inkMuted">
              Nothing is read until one is connected, and nothing is stored when it is.
            </p>
          </div>
        ) : (
          <ReadGate
            state={standings}
            loadingLabel="Reading your standing in each quarter…"
            failureLabel="Your scoreboard could not be read. Onchain reads did not succeed."
          >
            {(rows) => (
              <div className="space-y-4">
                {rows.map((row) => (
                  <QuarterRow
                    key={row.quarter}
                    row={row}
                    asset={assets.status === "ready" ? assets.data[row.quarter] : undefined}
                    cardsHeld={
                      owned.status === "ready"
                        ? owned.data.filter((c) => c.quarter === row.quarter).length
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </ReadGate>
        )}

        <div className="mt-10 border-rule border-ink bg-paperCard shadow-cardSeal">
          <h2 className="border-b-rule border-ink bg-seal px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-paperCard">
            Before you sell
          </h2>
          <div className="px-5 py-5">
          <p className="text-body-lg leading-relaxed text-ink">
            Credited amounts stay with this wallet and do not transfer with a card. Pending
            amounts settle to you when a card is sold.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-inkMuted">
            A marketplace will not explain this to either party. The buyer begins accruing from
            the moment of the sale and shares only in deposits that arrive afterwards.
          </p>
          </div>
        </div>

        <NonAffiliation className="mt-6 max-w-3xl" />
      </div>
    </>
  );
}

function QuarterRow({
  row,
  asset,
  cardsHeld,
}: {
  row: QuarterStanding;
  asset: RewardAssetInfo | undefined;
  cardsHeld: number | undefined;
}) {
  const quarter = QUARTERS[row.quarter];
  const nothingDeposited = row.totalDeposited === 0n;

  // Undefined is not zero. If either figure the claim depends on did not read back, the
  // control is disabled because the answer is unknown -- not because the answer is no.
  const {pendingOnCards, creditedToWallet} = row;
  const claimableUnknown = pendingOnCards === undefined || creditedToWallet === undefined;
  const hasClaimable =
    pendingOnCards !== undefined &&
    creditedToWallet !== undefined &&
    (pendingOnCards > 0n || creditedToWallet > 0n);

  return (
    <section className="border-rule border-ink bg-paperCard shadow-card">
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b-rule border-ink px-5 py-3 text-paperCard"
        style={{backgroundColor: `var(${quarter?.colorVar ?? "--quarter-1"})`}}
      >
        <p className="font-display text-xl font-bold">{quarter?.label}</p>
        {asset && (
          <span className="border border-paperCard/50 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em]">
            {asset.symbol}
          </span>
        )}
      </div>

      <div className="px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-inkMuted">
            {cardsHeld === undefined
              ? "—"
              : `${cardsHeld} card${cardsHeld === 1 ? "" : "s"} held`}
            {" · "}
            <span className="font-mono">
              {row.walletWeight.toString()} /{" "}
              {row.quarterWeight === undefined ? "—" : row.quarterWeight.toString()}
            </span>{" "}
            {BRAND.scoreTerm.toLowerCase()}
            {row.quarterWeight !== undefined && row.quarterWeight > 0n && (
              <>
                {" · "}
                <span className="text-inkMuted">
                  {formatShare(row.walletWeight, row.quarterWeight)} of this{" "}
                  {BRAND.groupTerm.toLowerCase()}
                </span>
              </>
            )}
          </p>
        </div>

      </div>

      {row.incomplete && (
        <p className="mt-3 text-xs text-inkMuted" role="alert">
          Some figures in this row did not read back, so this row is not complete.
        </p>
      )}

      {!asset ? (
        <p className="mt-4 text-sm text-inkMuted">
          No reward asset is configured for this {BRAND.groupTerm.toLowerCase()} in this
          deployment.
        </p>
      ) : nothingDeposited ? (
        <p className="mt-4 text-sm text-inkMuted">
          No rewards have been deposited to this {BRAND.groupTerm.toLowerCase()} yet.
        </p>
      ) : (
        <>
          <dl className="card-row mt-5 grid bg-ink sm:grid-cols-3">
            <Figure
              cap="bg-tint-sun"
              label="Pending on cards"
              value={amount(row.pendingOnCards, asset.decimals)}
              symbol={asset.symbol}
              note="Accruing on the cards themselves. Settles to you if you sell."
            />
            <Figure
              cap="bg-tint-mint"
              label="Credited to wallet"
              value={amount(row.creditedToWallet, asset.decimals)}
              symbol={asset.symbol}
              note="Already yours. Stays with this wallet, whatever happens to the cards."
            />
            <Figure
              cap="bg-tint-sky"
              label="Claimed to date"
              last
              value={amount(row.totalClaimed, asset.decimals)}
              symbol={asset.symbol}
              note={`Paid out of this ${BRAND.groupTerm.toLowerCase()} to all holders.`}
            />
          </dl>

          <p className="mt-4 font-mono text-xs text-inkMuted">
            Deposited to this {BRAND.groupTerm.toLowerCase()}:{" "}
            {amount(row.totalDeposited, asset.decimals)} {asset.symbol}
            {row.reserve !== undefined && row.reserve > 0n && (
              <>
                {" · "}held in reserve: {formatAssetAmount(row.reserve, asset.decimals)}
              </>
            )}
          </p>

          <div className="mt-5">
            <TxButton
              address={ADDRESSES.distributor}
              abi={distributorAbi}
              functionName="claimQuarter"
              // A scan bound of 0 means "all of this wallet's cards". The contract
              // reports how far it got, so a bounded run can be resumed.
              args={[EDITION_ID, row.quarter, 0n, 0n]}
              label={`Claim ${quarter?.short ?? ""} now`}
              pendingLabel="Claiming…"
              disabledReason={
                claimableUnknown
                  ? "What is claimable here could not be read, so this stays disabled."
                  : hasClaimable
                    ? undefined
                    : `Nothing to claim in this ${BRAND.groupTerm.toLowerCase()} yet.`
              }
            />
          </div>
        </>
      )}
      </div>
    </section>
  );
}

/** An amount, or an em dash. A dash means not read -- it never means zero. */
function amount(value: bigint | undefined, decimals: number): string {
  return value === undefined ? "—" : formatAssetAmount(value, decimals);
}

function Figure({
  cap,
  label,
  value,
  symbol,
  note,
  last = false,
}: {
  cap: string;
  label: string;
  value: string;
  symbol: string;
  note: string;
  last?: boolean;
}) {
  return (
    <div
      className={`bg-paperCard ${
        last ? "" : "border-b-rule border-ink sm:border-b-0 sm:border-r-rule"
      }`}
    >
      <div aria-hidden className={`tile-cap ${cap}`} />
      <div className="p-4">
        <dt className="rule-label">{label}</dt>
        <dd className="mt-2 font-mono text-xl font-semibold tabular-nums text-ink">
          {value} <span className="text-sm font-normal text-inkMuted">{symbol}</span>
        </dd>
        <p className="mt-2.5 text-xs leading-relaxed text-inkMuted">{note}</p>
      </div>
    </div>
  );
}
