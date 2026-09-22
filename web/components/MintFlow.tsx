"use client";

import {useState} from "react";
import {useAccount} from "wagmi";
import {maxUint256} from "viem";
import {BRAND, EDITION, LEVELS, QUARTERS} from "@/lib/brand";
import {ADDRESSES} from "@/lib/config";
import {minterAbi, tokenAbi} from "@/lib/abis";
import {formatWholeTokens} from "@/lib/format";
import {useBoardCounts, useMintState} from "@/lib/reads";
import {PageHeader} from "./Section";
import {PhaseNotice} from "./PhaseNotice";
import {ReadGate} from "./ReadGate";
import {PieceArt} from "./PieceArt";
import {TxButton} from "./TxButton";

const STEPS = [`Choose ${BRAND.groupTerm.toLowerCase()}`, "Preview", "Mint"] as const;

export function MintFlow() {
  const [quarter, setQuarter] = useState(0);
  const counts = useBoardCounts();
  const mint = useMintState();
  const house = LEVELS[0];

  return (
    <>
      <PageHeader
        heading="Claim a card."
        sub={`Choose a ${BRAND.groupTerm.toLowerCase()}, burn ${EDITION.mintBurn.toLocaleString("en-US")} ${BRAND.tokenTicker}, and take a permanent place on the board. Every card begins as a ${house?.form} at ${house?.weight} weight.`}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <PhaseNotice className="mb-8 max-w-3xl" />

        <ol className="mb-8 flex flex-wrap gap-x-6 gap-y-2">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2 text-sm text-ink-400">
              <span className="font-mono text-xs text-brass-500">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <div className="mb-8 flex flex-wrap gap-2">
          {[
            `${EDITION.cardSupply} fixed`,
            `${EDITION.mintBurn.toLocaleString("en-US")} ${BRAND.tokenTicker}`,
            `${EDITION.mintsPerWallet} primary mints`,
          ].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-ink-800 px-3 py-1 text-xs text-ink-300"
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div>
            <h2 className="rule-label mb-3">Choose a {BRAND.groupTerm.toLowerCase()}</h2>
            <ReadGate
              state={counts}
              loadingLabel="Reading card state…"
              failureLabel="Registry unavailable. Onchain reads did not succeed."
            >
              {(data) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  {QUARTERS.map((q) => {
                    const minted = Number(data.perQuarter[q.index] ?? 0n);
                    const full = minted >= EDITION.quarterCap;
                    return (
                      <button
                        key={q.index}
                        type="button"
                        onClick={() => setQuarter(q.index)}
                        aria-pressed={quarter === q.index}
                        disabled={full}
                        className={`panel p-4 text-left transition-colors disabled:opacity-40 ${
                          quarter === q.index ? "border-brass-500/60" : "hover:border-ink-700"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="h-2 w-2 rounded-full"
                            style={{backgroundColor: `var(${q.colorVar})`}}
                          />
                          <span className="text-sm text-ink-100">{q.label}</span>
                        </span>
                        <span className="mt-2 block font-mono text-xs text-ink-400">
                          {minted} / {EDITION.quarterCap} claimed
                        </span>
                        {full && (
                          <span className="mt-1 block text-xs text-ink-500">
                            This {BRAND.groupTerm.toLowerCase()} is fully claimed. Cards are
                            available from holders.
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ReadGate>

            <h2 className="rule-label mb-3 mt-8">Preview</h2>
            <div className="panel flex items-center gap-6 p-6">
              <PieceArt level={1} className="h-32 w-32 shrink-0" />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="rule-label">Starting form</dt>
                  <dd className="mt-0.5 text-ink-100">{house?.form}</dd>
                </div>
                <div>
                  <dt className="rule-label">Starting {BRAND.scoreTerm.toLowerCase()}</dt>
                  <dd className="mt-0.5 font-mono text-brass-400">{house?.weight}</dd>
                </div>
                <div>
                  <dt className="rule-label">{BRAND.groupTerm}</dt>
                  <dd className="mt-0.5 text-ink-100">{QUARTERS[quarter]?.label}</dd>
                </div>
                <div>
                  <dt className="rule-label">Burn</dt>
                  <dd className="mt-0.5 font-mono text-ink-200">
                    {EDITION.mintBurn.toLocaleString("en-US")} {BRAND.tokenTicker}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <MintPanel quarter={quarter} mint={mint} />
        </div>
      </div>
    </>
  );
}

function MintPanel({
  quarter,
  mint,
}: {
  quarter: number;
  mint: ReturnType<typeof useMintState>;
}) {
  const {isConnected} = useAccount();

  return (
    <div className="panel p-6">
      <h2 className="text-sm font-medium text-ink-100">Mint</h2>

      <ReadGate
        state={mint}
        loadingLabel="Reading launch and pause state…"
        // Fail closed: if these reads did not succeed, the control stays off and says why.
        failureLabel="Mint is unavailable. Launch and pause state could not be verified onchain, so minting stays disabled until those reads succeed."
      >
        {(state) => {
          const needsApproval =
            state.allowance !== undefined && state.allowance < state.mintBurn;
          const shortBalance =
            state.walletBalance !== undefined && state.walletBalance < state.mintBurn;
          const outOfMints = state.remainingForWallet === 0;

          let disabledReason: string | undefined;
          if (!state.open) disabledReason = "Minting is not open onchain right now.";
          else if (outOfMints) {
            disabledReason = `You've used all ${state.mintsPerWallet} primary mints. Cards are available from holders.`;
          } else if (shortBalance) {
            disabledReason = `Not enough ${BRAND.tokenTicker}. This action burns ${formatWholeTokens(state.mintBurn)}.`;
          } else if (needsApproval) {
            disabledReason = `Approve ${BRAND.tokenTicker} first.`;
          }

          return (
            <>
              <dl className="mt-4 space-y-3 text-sm">
                <Row label="Mints used">
                  {isConnected && state.remainingForWallet !== undefined
                    ? `${state.mintsPerWallet - state.remainingForWallet} / ${state.mintsPerWallet}`
                    : "—"}
                </Row>
                <Row label="Price">
                  {formatWholeTokens(state.mintBurn)} {BRAND.tokenTicker}
                </Row>
                <Row label="Your balance">
                  {state.walletBalance !== undefined
                    ? `${formatWholeTokens(state.walletBalance)} ${BRAND.tokenTicker}`
                    : "—"}
                </Row>
                <Row label="Status">
                  {state.paused ? (
                    <span className="text-ink-400">Paused onchain</span>
                  ) : (
                    <span className="text-quarter-3">Open</span>
                  )}
                </Row>
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
                  label="Mint card"
                  pendingLabel="Minting…"
                  disabledReason={disabledReason}
                  confirm={
                    <>
                      <strong className="block text-ink-100">
                        This burn is permanent.
                      </strong>
                      <span className="mt-1 block">
                        {formatWholeTokens(state.mintBurn)} {BRAND.tokenTicker} are destroyed and
                        cannot be recovered. You receive one {BRAND.itemName.toLowerCase()} in{" "}
                        {QUARTERS[quarter]?.label}.
                      </span>
                    </>
                  }
                />
              </div>

              <p className="mt-5 border-t border-ink-800 pt-4 text-xs leading-relaxed text-ink-500">
                This burn is permanent. The tokens are destroyed and cannot be recovered.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-ink-500">
                {EDITION.mintsPerWallet} primary mints per wallet. There is no limit on cards
                acquired from other holders.
              </p>
            </>
          );
        }}
      </ReadGate>
    </div>
  );
}

function Row({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="rule-label">{label}</dt>
      <dd className="font-mono text-ink-200">{children}</dd>
    </div>
  );
}
