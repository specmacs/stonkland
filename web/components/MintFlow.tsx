"use client";

import {useState, type ReactNode} from "react";
import {useAccount} from "wagmi";
import {maxUint256} from "viem";
import {BRAND, LEVELS, QUARTERS, REWARD_ASSET_EXPLAINER} from "@/lib/brand";
import {ADDRESSES, CHAIN_CONFIGURED, CHAIN_NAME} from "@/lib/config";
import {minterAbi, tokenAbi} from "@/lib/abis";
import {formatCount, formatWholeTokens} from "@/lib/format";
import {useBoardCounts, useMintState, useRewardAssets, type MintState} from "@/lib/reads";
import {ReadGate} from "./ReadGate";
import {PieceArt} from "./PieceArt";
import {Stars} from "./SectionHead";
import {TxButton} from "./TxButton";

/**
 * Claiming a card, as three numbered moves on one page.
 *
 * Laid out so the whole thing is visible at once rather than as a wizard: there are only
 * three decisions, and hiding two of them behind steps would make a short act feel long.
 *
 * Every figure here is read when the page loads. The supply, the price and the wallet
 * limit are all constants in the contracts, and they are still read rather than written
 * out, because this is the page where somebody is about to destroy tokens and the numbers
 * they are shown should be the ones the contract will actually enforce.
 */
export function MintFlow() {
  const [quarter, setQuarter] = useState(0);
  const counts = useBoardCounts();
  const mint = useMintState();
  const assets = useRewardAssets();
  const house = LEVELS[0];

  return (
    <>
      <div className="band-cream">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 lg:pb-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-seal">
            {BRAND.editionName}
            {CHAIN_CONFIGURED && <> · {CHAIN_NAME}</>}
          </p>

          <div className="mt-5 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <h1 className="font-display text-display-lg font-bold text-ink">
                Claim a {BRAND.itemName.toLowerCase()}.
              </h1>
              <p className="mt-5 max-w-xl text-body-lg text-inkMuted">
                Pick a {BRAND.groupTerm.toLowerCase()}, burn {BRAND.tokenTicker}, and take a
                permanent place on the board. Every card begins as a {house?.form} and rises only
                by burning more.
              </p>
            </div>

            <HeaderFigures mint={mint} counts={counts} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6">
        <div className="border-rule border-ink bg-paperCard shadow-cardLg">
          <Step
            n={1}
            label={`Choose a ${BRAND.groupTerm.toLowerCase()}`}
            value={QUARTERS[quarter]?.label ?? ""}
            tint="bg-tint-sky"
          >
            <ReadGate
              state={counts}
              loadingLabel={`Reading each ${BRAND.groupTerm.toLowerCase()}'s count…`}
              failureLabel="Counts did not read back, so no quarter can be chosen yet."
            >
              {(data) => (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {QUARTERS.map((q) => (
                    <QuarterTile
                      key={q.index}
                      index={q.index}
                      label={q.label}
                      colorVar={q.colorVar}
                      minted={data.perQuarter[q.index] ?? 0n}
                      cap={data.quarterCap}
                      symbol={assets.status === "ready" ? assets.data[q.index]?.symbol : undefined}
                      chosen={quarter === q.index}
                      onChoose={() => setQuarter(q.index)}
                    />
                  ))}
                </div>
              )}
            </ReadGate>
          </Step>

          <div className="grid border-t-rule border-ink lg:grid-cols-2">
            <Step
              n={2}
              label="What you receive"
              value={`${house?.form} · one star`}
              tint="bg-tint-sun"
              inner
            >
              <CardPreview quarter={quarter} />
            </Step>

            <div className="border-t-rule border-ink lg:border-l-rule lg:border-t-0">
              <Step
                n={3}
                label={`Mint in ${QUARTERS[quarter]?.label ?? ""}`}
                value={`${house?.form} · ${BRAND.scoreTerm} ${house?.weight}`}
                tint="bg-tint-mint"
                inner
              >
                <MintPanel quarter={quarter} mint={mint} counts={counts} />
              </Step>
            </div>
          </div>
        </div>

        <p className="mt-8 max-w-4xl border-l-4 border-ink/15 pl-5 text-xs leading-relaxed text-inkMuted">
          {REWARD_ASSET_EXPLAINER} Rewards are not guaranteed in availability or amount, and the
          reward asset grants no legal or beneficial ownership of any underlying security.{" "}
          {BRAND.projectName} is not affiliated with, endorsed by, or sponsored by any company
          whose share price a reward asset tracks.
        </p>
      </div>
    </>
  );
}

/**
 * Supply, price and wallet limit, read rather than written out.
 *
 * They sit beside the headline because they are the three numbers somebody weighs before
 * reading anything else, and because a page that asks you to destroy tokens should lead
 * with what it costs.
 */
function HeaderFigures({
  mint,
  counts,
}: {
  mint: ReturnType<typeof useMintState>;
  counts: ReturnType<typeof useBoardCounts>;
}) {
  const price = mint.status === "ready" ? mint.data.mintBurn : undefined;
  const limit = mint.status === "ready" ? mint.data.mintsPerWallet : undefined;
  const supply = counts.status === "ready" ? counts.data.cardSupply : undefined;

  return (
    <dl className="grid shrink-0 grid-cols-3 border-rule border-ink bg-paperCard shadow-card">
      <Figure label="Supply" value={supply === undefined ? undefined : formatCount(supply)} unit="cards, fixed" />
      <Figure
        label="Price"
        value={price === undefined ? undefined : formatWholeTokens(price)}
        unit={`${BRAND.tokenTicker}, burned`}
      />
      <Figure
        label="Wallet limit"
        value={limit === undefined ? undefined : String(limit)}
        unit="primary mints"
        last
      />
    </dl>
  );
}

function Figure({
  label,
  value,
  unit,
  last = false,
}: {
  label: string;
  value: string | undefined;
  unit: string;
  last?: boolean;
}) {
  return (
    <div className={`px-5 py-4 ${last ? "" : "border-r border-ink/15"}`}>
      <dt className="rule-label">{label}</dt>
      <dd className="mt-2 font-mono text-xl font-semibold tabular-nums leading-none text-ink">
        {value ?? <span className="text-inkFaint">—</span>}
      </dd>
      <p className="mt-1.5 text-[11px] text-inkMuted">{unit}</p>
    </div>
  );
}

/** One numbered move, with what has been chosen for it stated in the header. */
function Step({
  n,
  label,
  value,
  tint,
  inner = false,
  children,
}: {
  n: number;
  label: string;
  value: string;
  tint: string;
  inner?: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <header className={`flex items-center gap-4 border-b-rule border-ink px-5 py-3.5 ${tint}`}>
        <span className="pip bg-paperCard text-ink">{n}</span>
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/60">{label}</p>
          <p className="truncate font-display text-lg font-bold text-ink">{value}</p>
        </div>
      </header>
      <div className={inner ? "p-5" : "p-5"}>{children}</div>
    </section>
  );
}

function QuarterTile({
  index,
  label,
  colorVar,
  minted,
  cap,
  symbol,
  chosen,
  onChoose,
}: {
  index: number;
  label: string;
  colorVar: string;
  minted: bigint;
  cap: bigint;
  symbol: string | undefined;
  chosen: boolean;
  onChoose: () => void;
}) {
  const full = minted >= cap;
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-pressed={chosen}
      disabled={full}
      className={`border-rule border-ink bg-paperCard text-left transition-transform disabled:opacity-45 ${
        chosen ? "shadow-card" : "hover:-translate-x-px hover:-translate-y-px hover:shadow-cardSm"
      }`}
    >
      <span
        aria-hidden
        className={`block w-full border-b-rule border-ink ${chosen ? "h-4" : "h-2"}`}
        style={{backgroundColor: `var(${colorVar})`}}
      />
      <span className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <span className="font-display text-base font-bold leading-tight text-ink">{label}</span>
        {/* The symbol is read from the asset's own contract, never the name in config. */}
        {symbol && (
          <span className="shrink-0 border border-ink/25 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-inkMuted">
            {symbol}
          </span>
        )}
      </span>
      <span className="mt-2 flex items-baseline justify-between gap-2 px-4 pb-4">
        <span className="font-mono text-lg tabular-nums text-ink">
          {formatCount(minted)}
          <span className="text-inkFaint"> / {formatCount(cap)}</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-inkMuted">
          {full ? "Full" : `id ${index * Number(cap) + 1}–${(index + 1) * Number(cap)}`}
        </span>
      </span>
    </button>
  );
}

/** The card as a card: the same frame a minted one gets, with nothing invented in it. */
function CardPreview({quarter}: {quarter: number}) {
  const meta = QUARTERS[quarter];
  const house = LEVELS[0];

  return (
    <div className="mx-auto max-w-xs border-rule border-ink bg-paperCard shadow-cardLg">
      <div
        className="flex items-center justify-between gap-2 border-b-rule border-ink px-4 py-2.5 text-paperCard"
        style={{backgroundColor: `var(${meta?.colorVar ?? "--quarter-1"})`}}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{meta?.label}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-80">Lv 1</span>
      </div>

      <div className="flex flex-col items-center bg-tint-cream px-4 py-6">
        <PieceArt level={1} priority className="h-40 w-40" />
        <Stars level={1} className="mt-4" />
      </div>

      <div className="border-t-rule border-ink px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-xl font-bold text-ink">{house?.form}</p>
          <p className="font-mono text-xl font-semibold tabular-nums text-seal">{house?.weight}</p>
        </div>
        <p className="rule-label mt-1">
          {BRAND.scoreTerm} at mint <span className="text-inkFaint">· from the schedule</span>
        </p>
        <p className="mt-3 border-t border-ink/10 pt-2.5 text-[11px] leading-relaxed text-inkMuted">
          This is the level-one entry in the fixed schedule, not a reading — a card that does
          not exist yet has no onchain weight to read. Its number is assigned by the contract
          at mint, which is why none is shown above.
        </p>
      </div>
    </div>
  );
}

function MintPanel({
  quarter,
  mint,
  counts,
}: {
  quarter: number;
  mint: ReturnType<typeof useMintState>;
  counts: ReturnType<typeof useBoardCounts>;
}) {
  const {isConnected} = useAccount();
  const quarterFull =
    counts.status === "ready" &&
    (counts.data.perQuarter[quarter] ?? 0n) >= counts.data.quarterCap;

  return (
    <ReadGate
      state={mint}
      loadingLabel="Reading launch and pause state…"
      // Fail closed: if these reads did not succeed, the control stays off and says why.
      failureLabel="Minting is unavailable, and stays disabled until these reads succeed."
    >
      {(state) => {
        const needsApproval =
          state.allowance !== undefined && state.allowance < state.mintBurn;
        const shortBalance =
          state.walletBalance !== undefined && state.walletBalance < state.mintBurn;
        const outOfMints = state.remainingForWallet === 0;

        let disabledReason: string | undefined;
        if (!state.open) disabledReason = "Minting is not open onchain right now.";
        else if (quarterFull) {
          disabledReason = `This ${BRAND.groupTerm.toLowerCase()} is fully claimed. Cards are available from holders.`;
        } else if (outOfMints) {
          disabledReason = `You've used all ${state.mintsPerWallet} primary mints. Cards are available from holders.`;
        } else if (shortBalance) {
          disabledReason = `Not enough ${BRAND.tokenTicker}. This action burns ${formatWholeTokens(state.mintBurn)}.`;
        } else if (needsApproval) {
          disabledReason = `Approve ${BRAND.tokenTicker} first.`;
        }

        return (
          <>
            <Callout state={state} quarterFull={quarterFull} connected={isConnected} />

            <dl className="mt-5 grid grid-cols-2 border-rule border-ink">
              <Fact
                label="Your mints used"
                value={
                  isConnected && state.remainingForWallet !== undefined
                    ? `${state.mintsPerWallet - state.remainingForWallet} / ${state.mintsPerWallet}`
                    : undefined
                }
              />
              <Fact label="Mint price" value={`${formatWholeTokens(state.mintBurn)} ${BRAND.tokenTicker}`} last />
              <Fact
                label="Your balance"
                value={
                  state.walletBalance !== undefined
                    ? `${formatWholeTokens(state.walletBalance)} ${BRAND.tokenTicker}`
                    : undefined
                }
                bottom
              />
              <Fact
                label="Minting"
                value={state.paused ? "Paused onchain" : state.open ? "Open" : "Not open"}
                tone={state.paused || !state.open ? "muted" : "good"}
                last
                bottom
              />
            </dl>

            <div className="mt-5 space-y-3">
              {needsApproval && (
                <TxButton
                  address={ADDRESSES.token}
                  abi={tokenAbi}
                  functionName="approve"
                  args={[ADDRESSES.minter, maxUint256]}
                  label={`Approve ${BRAND.tokenTicker}`}
                  pendingLabel="Approving…"
                  variant="secondary"
                  disabledReason={
                    ADDRESSES.minter ? undefined : "Minter address is not configured."
                  }
                />
              )}

              <TxButton
                address={ADDRESSES.minter}
                abi={minterAbi}
                functionName="mint"
                args={[quarter]}
                label={`Mint in ${QUARTERS[quarter]?.label ?? ""}`}
                pendingLabel="Minting…"
                disabledReason={disabledReason}
                confirm={
                  <>
                    <strong className="block text-ink">This burn is permanent.</strong>
                    <span className="mt-1 block">
                      {formatWholeTokens(state.mintBurn)} {BRAND.tokenTicker} are destroyed and
                      cannot be recovered. You receive one {BRAND.itemName.toLowerCase()} in{" "}
                      {QUARTERS[quarter]?.label}.
                    </span>
                  </>
                }
              />
            </div>

            <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-ink/15 pt-4 font-mono text-[11px] text-inkMuted">
              <span>Permanent burn</span>
              <span aria-hidden className="text-inkFaint">·</span>
              <span>
                Primary mints left:{" "}
                {isConnected && state.remainingForWallet !== undefined
                  ? state.remainingForWallet
                  : "—"}
              </span>
              <span aria-hidden className="text-inkFaint">·</span>
              <span>No limit on cards acquired from holders</span>
            </p>
          </>
        );
      }}
    </ReadGate>
  );
}

/** The one thing standing between this wallet and a card, said once and plainly. */
function Callout({
  state,
  quarterFull,
  connected,
}: {
  state: MintState;
  quarterFull: boolean;
  connected: boolean;
}) {
  if (!state.open || state.paused) {
    return (
      <Notice tone="bg-tint-peach">
        <strong className="block text-ink">Minting is not open onchain.</strong>
        Nothing can be claimed until the contract says otherwise.
      </Notice>
    );
  }
  if (quarterFull) {
    return (
      <Notice tone="bg-tint-sun">
        <strong className="block text-ink">
          This {BRAND.groupTerm.toLowerCase()} is fully claimed.
        </strong>
        Every card in it has an owner. Choose another, or acquire one from a holder.
      </Notice>
    );
  }
  if (!connected) {
    return (
      <Notice tone="bg-tint-sky">
        <strong className="block text-ink">Connect a wallet to continue.</strong>
        Use the wallet control in the header.
      </Notice>
    );
  }
  if (state.remainingForWallet === 0) {
    return (
      <Notice tone="bg-tint-sun">
        <strong className="block text-ink">
          This wallet has used all {state.mintsPerWallet} primary mints.
        </strong>
        There is no limit on cards acquired from other holders.
      </Notice>
    );
  }
  return null;
}

function Notice({tone, children}: {tone: string; children: ReactNode}) {
  return (
    <p className={`border-rule border-ink px-4 py-3 text-sm leading-relaxed text-ink/75 ${tone}`}>
      {children}
    </p>
  );
}

function Fact({
  label,
  value,
  tone = "ink",
  last = false,
  bottom = false,
}: {
  label: string;
  value: string | undefined;
  tone?: "ink" | "muted" | "good";
  last?: boolean;
  bottom?: boolean;
}) {
  const colour =
    tone === "good" ? "text-quarter-3" : tone === "muted" ? "text-inkMuted" : "text-ink";
  return (
    <div
      className={`px-4 py-3.5 ${last ? "" : "border-r border-ink/15"} ${bottom ? "" : "border-b border-ink/15"}`}
    >
      <p className="rule-label">{label}</p>
      <p className={`mt-1.5 font-mono text-base tabular-nums ${colour}`}>
        {value ?? <span className="text-inkFaint">—</span>}
      </p>
    </div>
  );
}
