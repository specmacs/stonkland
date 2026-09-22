"use client";

import {useAccount} from "wagmi";
import {maxUint256} from "viem";
import {BRAND, QUARTERS, formName} from "@/lib/brand";
import {ADDRESSES} from "@/lib/config";
import {progressionManagerAbi, tokenAbi} from "@/lib/abis";
import {formatAssetAmount, formatWholeTokens} from "@/lib/format";
import {useBuildPaused, useOwnedCards, useRewardAssets, type OwnedCard} from "@/lib/reads";
import {PageHeader} from "./Section";
import {Stars} from "./SectionHead";
import {ReadGate} from "./ReadGate";
import {PieceArt} from "./PieceArt";
import {TxButton} from "./TxButton";

export function MyCards() {
  const {isConnected} = useAccount();
  const owned = useOwnedCards();
  const assets = useRewardAssets();
  const buildPaused = useBuildPaused();

  return (
    <>
      <PageHeader
        eyebrow="Held by the connected wallet"
        heading="Your cards."
        sub={`Every card you hold, with its level, weight, lifetime burn, and pending ${BRAND.rewardsPageTerm.toLowerCase()}.`}
        tone="cream"
      />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6">
        {!isConnected ? (
          <div className="border-rule border-ink bg-paperCard px-6 py-16 text-center shadow-cardLg">
            <p className="font-display text-2xl font-bold text-ink">
              Connect a wallet to read its cards.
            </p>
            <p className="mt-3 text-sm text-inkMuted">
              Cards are read from the configured network. Nothing is stored here.
            </p>
          </div>
        ) : (
          <ReadGate
            state={owned}
            loadingLabel="Reading your cards…"
            failureLabel="Your cards could not be read. Onchain reads did not succeed."
          >
            {(cards) =>
              cards.length === 0 ? (
                <div className="border-rule border-ink bg-paperCard px-6 py-16 text-center shadow-cardLg">
                  <p className="font-display text-2xl font-bold text-ink">
                    No cards in this wallet yet.
                  </p>
                  <p className="mt-3 text-sm text-inkMuted">
                    Claim one on the mint page, or acquire one from a holder.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {cards.map((card) => (
                    <CardRow
                      key={card.tokenId.toString()}
                      card={card}
                      assetSymbol={
                        assets.status === "ready"
                          ? assets.data[card.quarter]?.symbol
                          : undefined
                      }
                      assetDecimals={
                        assets.status === "ready"
                          ? assets.data[card.quarter]?.decimals
                          : undefined
                      }
                      buildPaused={buildPaused.status === "ready" ? buildPaused.data : undefined}
                    />
                  ))}
                </div>
              )
            }
          </ReadGate>
        )}
      </div>
    </>
  );
}

function CardRow({
  card,
  assetSymbol,
  assetDecimals,
  buildPaused,
}: {
  card: OwnedCard;
  assetSymbol: string | undefined;
  assetDecimals: number | undefined;
  buildPaused: boolean | undefined;
}) {
  const quarter = QUARTERS[card.quarter];
  const maxed = card.nextLevel === undefined;

  let disabledReason: string | undefined;
  if (maxed) disabledReason = `This card is a ${formName(card.level)}. There is nothing above it.`;
  else if (buildPaused === undefined) {
    disabledReason = "Pause state could not be verified onchain, so building stays disabled.";
  } else if (buildPaused) disabledReason = "Building is paused onchain right now.";

  return (
    <article className="border-rule border-ink bg-paperCard shadow-cardLg">
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b-rule border-ink px-5 py-3 text-paperCard"
        style={{backgroundColor: `var(${quarter?.colorVar ?? "--quarter-1"})`}}
      >
        <p className="font-display text-lg font-bold">
          #{card.tokenId.toString()} · {formName(card.level)}
        </p>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-85">
          {quarter?.label}
        </span>
      </div>

      <div className="p-5">
      <div className="flex gap-5">
        <div className="shrink-0 text-center">
          <PieceArt level={card.level} className="h-24 w-24" />
          <Stars level={card.level} className="mt-2" size="sm" />
        </div>

        <div className="min-w-0 flex-1">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="rule-label">{BRAND.scoreTerm}</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-seal">
                {card.weight}
              </dd>
            </div>
            <div>
              <dt className="rule-label">Lifetime burn</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">
                {formatWholeTokens(card.burned)}
              </dd>
            </div>
            <div className="col-span-2 border-t border-ink/10 pt-3">
              <dt className="rule-label">Pending on this card</dt>
              <dd className="mt-1 font-mono text-ink">
                {card.pending === undefined ? (
                  <span className="text-inkMuted">Could not be read</span>
                ) : assetSymbol && assetDecimals !== undefined ? (
                  `${formatAssetAmount(card.pending, assetDecimals)} ${assetSymbol}`
                ) : (
                  <span className="text-inkMuted">
                    No reward asset is configured for this {BRAND.groupTerm.toLowerCase()}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-5 border-t-rule border-ink pt-4">
        {maxed ? (
          <p className="text-xs text-inkMuted">
            At the top of the ladder. This card cannot be built further, reduced, or reset.
          </p>
        ) : (
          <BuildControl card={card} disabledReason={disabledReason} />
        )}
      </div>
      </div>
    </article>
  );
}

function BuildControl({
  card,
  disabledReason,
}: {
  card: OwnedCard;
  disabledReason: string | undefined;
}) {
  const nextLevel = card.nextLevel;
  const nextWeight = card.nextWeight;
  const nextBurn = card.nextBurn;
  if (nextLevel === undefined || nextWeight === undefined || nextBurn === undefined) return null;

  return (
    <div>
      <p className="mb-3 text-sm text-inkMuted">
        Build to {formName(nextLevel)} — burns{" "}
        <span className="font-mono text-ink">{formatWholeTokens(nextBurn)}</span>{" "}
        {BRAND.tokenTicker}, raising {BRAND.scoreTerm.toLowerCase()} to{" "}
        <span className="font-mono text-seal">{nextWeight}</span>.
      </p>

      <div className="flex flex-wrap gap-2">
        <TxButton
          address={ADDRESSES.token}
          abi={tokenAbi}
          functionName="approve"
          args={[ADDRESSES.progressionManager, maxUint256]}
          label="Approve"
          pendingLabel="Approving…"
          variant="secondary"
          disabledReason={
            ADDRESSES.progressionManager ? undefined : "Manager address is not configured."
          }
        />
        <TxButton
          address={ADDRESSES.progressionManager}
          abi={progressionManagerAbi}
          functionName="build"
          args={[card.tokenId]}
          label={`Build to ${formName(nextLevel)}`}
          pendingLabel="Building…"
          disabledReason={disabledReason}
          confirm={
            <>
              <strong className="block text-ink">
                Build to {formName(nextLevel)}?
              </strong>
              <span className="mt-1 block">
                This destroys {formatWholeTokens(nextBurn)} {BRAND.tokenTicker} permanently and
                raises this card&apos;s {BRAND.scoreTerm.toLowerCase()} to {nextWeight}. It cannot
                be undone.
              </span>
            </>
          }
        />
      </div>
    </div>
  );
}
