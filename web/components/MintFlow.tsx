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
        eyebrow="Primary mint"
        heading="Claim a card."
        sub={`Choose a ${BRAND.groupTerm.toLowerCase()}, burn ${EDITION.mintBurn.toLocaleString("en-US")} ${BRAND.tokenTicker}, and take a permanent place on the board. Every card begins as a ${house?.form} at ${house?.weight} weight.`}
        tone="cream"
      />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6">
        <PhaseNotice className="mb-8 max-w-3xl" />

        <div className="card-row mb-10 grid bg-ink sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className={`flex items-center gap-3 px-5 py-4 ${
                ["bg-tint-sun", "bg-tint-peach", "bg-tint-mint"][i] ?? "bg-tint-cream"
              } ${i < STEPS.length - 1 ? "border-b-rule border-ink sm:border-b-0 sm:border-r-rule" : ""}`}
            >
              <span className="pip bg-paperCard text-ink">{i + 1}</span>
              <span className="font-display text-base font-bold text-ink">{step}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div>
            <h2 className="rule-label mb-4">Choose a {BRAND.groupTerm.toLowerCase()}</h2>
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
                        className={`border-rule border-ink bg-paperCard text-left transition-transform disabled:opacity-40 ${
                          quarter === q.index
                            ? "shadow-card"
                            : "hover:-translate-x-px hover:-translate-y-px hover:shadow-cardSm"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`block w-full border-b-rule border-ink ${
                            quarter === q.index ? "h-4" : "h-2.5"
                          }`}
                          style={{backgroundColor: `var(${q.colorVar})`}}
                        />
                        <span className="block px-4 py-4">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="font-display text-lg font-bold text-ink">
                              {q.label}
                            </span>
                            {quarter === q.index && (
                              <span className="border border-ink bg-ink px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-paperCard">
                                Chosen
                              </span>
                            )}
                          </span>
                          <span className="mt-2 block font-mono text-sm tabular-nums text-inkMuted">
                            {minted} / {EDITION.quarterCap} claimed
                          </span>
                          {full && (
                            <span className="mt-1.5 block text-xs text-inkMuted">
                              This {BRAND.groupTerm.toLowerCase()} is fully claimed. Cards are
                              available from holders.
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </ReadGate>

            <h2 className="rule-label mb-4 mt-10">Preview</h2>
            <div className="border-rule border-ink bg-paperCard shadow-cardLg">
              <div
                className="border-b-rule border-ink px-5 py-2.5 text-paperCard"
                style={{backgroundColor: `var(${QUARTERS[quarter]?.colorVar ?? "--quarter-1"})`}}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.16em]">
                  What you receive
                </p>
              </div>
              <div className="flex items-center gap-6 bg-tint-cream p-6">
              <PieceArt level={1} className="h-32 w-32 shrink-0" />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="rule-label">Starting form</dt>
                  <dd className="mt-0.5 text-ink">{house?.form}</dd>
                </div>
                <div>
                  <dt className="rule-label">Starting {BRAND.scoreTerm.toLowerCase()}</dt>
                  <dd className="mt-0.5 font-mono text-seal">{house?.weight}</dd>
                </div>
                <div>
                  <dt className="rule-label">{BRAND.groupTerm}</dt>
                  <dd className="mt-0.5 text-ink">{QUARTERS[quarter]?.label}</dd>
                </div>
                <div>
                  <dt className="rule-label">Burn</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {EDITION.mintBurn.toLocaleString("en-US")} {BRAND.tokenTicker}
                  </dd>
                </div>
              </dl>
              </div>
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
    <div className="border-rule border-ink bg-paperCard shadow-cardLg lg:sticky lg:top-28">
      <div className="border-b-rule border-ink bg-ink px-5 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-field-sun">Mint</h2>
      </div>
      <div className="p-5">

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
              <dl className="space-y-3 text-sm">
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
                    <span className="text-inkMuted">Paused onchain</span>
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
                      <strong className="block text-ink">
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

              <p className="mt-6 border-t-rule border-ink pt-4 text-xs leading-relaxed text-inkMuted">
                This burn is permanent. The tokens are destroyed and cannot be recovered.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-inkMuted">
                {EDITION.mintsPerWallet} primary mints per wallet. There is no limit on cards
                acquired from other holders.
              </p>
            </>
          );
        }}
      </ReadGate>
      </div>
    </div>
  );
}

function Row({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="rule-label">{label}</dt>
      <dd className="font-mono text-ink">{children}</dd>
    </div>
  );
}
