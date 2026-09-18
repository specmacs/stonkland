"use client";

import {useAccount} from "wagmi";
import {maxUint256} from "viem";
import {BRAND, QUARTERS, formName} from "@/lib/brand";
import {ADDRESSES} from "@/lib/config";
import {progressionManagerAbi, tokenAbi} from "@/lib/abis";
import {formatAssetAmount, formatWholeTokens} from "@/lib/format";
import {useBuildPaused, useOwnedCards, useRewardAssets, type OwnedCard} from "@/lib/reads";
import {PageHeader} from "./Section";
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
        heading="Your cards."
        sub={`Every card you hold, with its level, weight, lifetime burn, and pending ${BRAND.rewardsPageTerm.toLowerCase()}.`}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {!isConnected ? (
          <div className="panel p-8 text-center text-sm text-ink-300">
            Connect a wallet to read its cards from the configured network.
          </div>
        ) : (
          <ReadGate
            state={owned}
            loadingLabel="Reading your cards…"
            failureLabel="Your cards could not be read. Onchain reads did not succeed."
          >
            {(cards) =>
              cards.length === 0 ? (
                <div className="panel p-8 text-center text-sm text-ink-300">
                  No cards in this wallet yet.
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
    <article className="panel p-5">
      <div className="flex gap-5">
        <PieceArt level={card.level} className="h-24 w-24 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="rule-label flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{backgroundColor: `var(${quarter?.colorVar ?? "--quarter-1"})`}}
            />
            {quarter?.label}
          </p>
          <h2 className="mt-1 truncate text-base font-medium text-ink-100">
            #{card.tokenId.toString()} · {formName(card.level)}
          </h2>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="rule-label">{BRAND.scoreTerm}</dt>
              <dd className="mt-0.5 font-mono text-brass-400">{card.weight}</dd>
            </div>
            <div>
              <dt className="rule-label">Lifetime burn</dt>
              <dd className="mt-0.5 font-mono text-ink-200">{formatWholeTokens(card.burned)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="rule-label">Pending on this card</dt>
              <dd className="mt-0.5 font-mono text-ink-200">
                {card.pending === undefined ? (
                  <span className="text-ink-500">Could not be read</span>
                ) : assetSymbol && assetDecimals !== undefined ? (
                  `${formatAssetAmount(card.pending, assetDecimals)} ${assetSymbol}`
                ) : (
                  <span className="text-ink-500">
                    No reward asset is configured for this {BRAND.groupTerm.toLowerCase()}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-5 border-t border-ink-800 pt-4">
        {maxed ? (
          <p className="text-xs text-ink-500">
            At the top of the ladder. This card cannot be built further, reduced, or reset.
          </p>
        ) : (
          <BuildControl card={card} disabledReason={disabledReason} />
        )}
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
      <p className="mb-3 text-sm text-ink-300">
        Build to {formName(nextLevel)} — burns{" "}
        <span className="font-mono text-ink-100">{formatWholeTokens(nextBurn)}</span>{" "}
        {BRAND.tokenTicker}, raising {BRAND.scoreTerm.toLowerCase()} to{" "}
        <span className="font-mono text-brass-400">{nextWeight}</span>.
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
              <strong className="block text-ink-100">
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
