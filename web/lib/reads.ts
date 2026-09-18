"use client";

import {useMemo} from "react";
import {useAccount, useReadContract} from "wagmi";
import type {Address} from "viem";
import {
  distributorAbi,
  erc20MetadataAbi,
  feeRouterAbi,
  minterAbi,
  progressionManagerAbi,
  propertyNftAbi,
  revenueVaultAbi,
  streamVaultAbi,
  tokenAbi,
} from "./abis";
import {ADDRESSES, EDITION_ID, REWARD_ASSETS, type ContractKey} from "./config";
import {EDITION} from "./brand";
import {Cursor, useBatch, type Call} from "./batch";

/**
 * Every read in the interface goes through here.
 *
 * The shape below is the build handoff's rule made structural: a value exists only when
 * its read succeeded. Nothing in this file substitutes a default, a last-known value or
 * an estimate for a read that failed. A number on screen is a claim about chain state,
 * and a claim nobody can verify should not be made.
 */
export type ReadState<T> =
  | {status: "unconfigured"; missing: string[]}
  | {status: "loading"}
  | {status: "error"; error: Error}
  | {status: "ready"; data: T};

export function isReady<T>(s: ReadState<T>): s is {status: "ready"; data: T} {
  return s.status === "ready";
}

const QUARTERS = [0, 1, 2, 3] as const;

function addr(key: ContractKey): Address | undefined {
  return ADDRESSES[key];
}

function unconfigured<T>(missing: string[]): ReadState<T> {
  return {status: "unconfigured", missing};
}

export type CardState = {
  tokenId: bigint;
  quarter: number;
  level: number;
  weight: number;
  burned: bigint;
  owner: Address;
};

type PropertyTuple = {quarter: number; level: number; weight: number; burned: bigint};

/** Claimed counts for the board, global and per quarter. */
export function useBoardCounts(): ReadState<{total: bigint; perQuarter: bigint[]}> {
  const nft = addr("nft");

  const calls: Call[] = nft
    ? [
        {address: nft, abi: propertyNftAbi, functionName: "totalSupply"},
        ...QUARTERS.map((q) => ({
          address: nft,
          abi: propertyNftAbi,
          functionName: "mintedInQuarter",
          args: [q],
        })),
      ]
    : [];

  const batch = useBatch(calls, Boolean(nft));

  return useMemo(() => {
    if (!nft) return unconfigured<{total: bigint; perQuarter: bigint[]}>(["NEXT_PUBLIC_NFT_ADDRESS"]);
    if (batch.isPending) return {status: "loading"};
    if (batch.error) return {status: "error", error: batch.error};

    const cursor = new Cursor(batch.results);
    const total = cursor.nextBigint();
    const perQuarter = QUARTERS.map(() => cursor.nextBigint());

    if (total === undefined || perQuarter.some((v) => v === undefined)) {
      return {status: "error", error: new Error("Card counts did not read back from the collection.")};
    }
    return {status: "ready", data: {total, perQuarter: perQuarter as bigint[]}};
  }, [nft, batch.isPending, batch.error, batch.results]);
}

/**
 * The minted cards of one quarter, in a single batch.
 *
 * Only ids that exist are read. An unminted plot is never handed a placeholder owner,
 * level or weight -- it is simply absent here, and the board draws it as the capacity
 * it is.
 */
export function useQuarterCards(quarter: number, mintedCount: number): ReadState<CardState[]> {
  const nft = addr("nft");
  const firstId = BigInt(quarter) * BigInt(EDITION.quarterCap) + 1n;

  const ids = useMemo(
    () => Array.from({length: mintedCount}, (_, i) => firstId + BigInt(i)),
    [firstId, mintedCount],
  );

  const calls: Call[] = nft
    ? ids.flatMap((tokenId) => [
        {address: nft, abi: propertyNftAbi, functionName: "propertyOf", args: [tokenId]},
        {address: nft, abi: propertyNftAbi, functionName: "ownerOf", args: [tokenId]},
      ])
    : [];

  const batch = useBatch(calls, Boolean(nft));

  return useMemo(() => {
    if (!nft) return unconfigured<CardState[]>(["NEXT_PUBLIC_NFT_ADDRESS"]);
    if (ids.length === 0) return {status: "ready", data: []};
    if (batch.isPending) return {status: "loading"};
    if (batch.error) return {status: "error", error: batch.error};

    const cursor = new Cursor(batch.results);
    const cards: CardState[] = [];
    for (const tokenId of ids) {
      const property = cursor.next<PropertyTuple>();
      const owner = cursor.next<Address>();
      // A card whose read failed is left out rather than shown half-known.
      if (!property || !owner) continue;
      cards.push({
        tokenId,
        quarter: property.quarter,
        level: property.level,
        weight: property.weight,
        burned: property.burned,
        owner,
      });
    }
    return {status: "ready", data: cards};
  }, [nft, ids, batch.isPending, batch.error, batch.results]);
}

export type MintState = {
  open: boolean;
  paused: boolean;
  mintBurn: bigint;
  mintsPerWallet: number;
  remainingForWallet: number | undefined;
  walletBalance: bigint | undefined;
  allowance: bigint | undefined;
};

/** Whether minting can happen right now, and on what terms. */
export function useMintState(): ReadState<MintState> {
  const {address: wallet} = useAccount();
  const minter = addr("minter");
  const token = addr("token");

  const calls: Call[] = [];
  if (minter) {
    calls.push(
      {address: minter, abi: minterAbi, functionName: "mintOpen"},
      {address: minter, abi: minterAbi, functionName: "paused"},
      {address: minter, abi: minterAbi, functionName: "MINT_BURN"},
      {address: minter, abi: minterAbi, functionName: "MINTS_PER_WALLET"},
    );
    if (token && wallet) {
      calls.push(
        {address: minter, abi: minterAbi, functionName: "remainingMints", args: [wallet]},
        {address: token, abi: tokenAbi, functionName: "balanceOf", args: [wallet]},
        {address: token, abi: tokenAbi, functionName: "allowance", args: [wallet, minter]},
      );
    }
  }

  const batch = useBatch(calls, Boolean(minter));

  return useMemo(() => {
    const missing: string[] = [];
    if (!minter) missing.push("NEXT_PUBLIC_MINTER_ADDRESS");
    if (!token) missing.push("NEXT_PUBLIC_TOKEN_ADDRESS");
    if (missing.length > 0) return unconfigured<MintState>(missing);
    if (batch.isPending) return {status: "loading"};
    if (batch.error) return {status: "error", error: batch.error};

    const cursor = new Cursor(batch.results);
    const open = cursor.next<boolean>();
    const paused = cursor.next<boolean>();
    const mintBurn = cursor.nextBigint();
    const mintsPerWallet = cursor.next<number>();

    // Launch state and pause state are the two reads that gate the button. If either has
    // not come back, minting stays disabled and the page says why.
    if (open === undefined || paused === undefined || mintBurn === undefined || mintsPerWallet === undefined) {
      return {
        status: "error",
        error: new Error("Launch and pause state could not be verified onchain."),
      };
    }

    const remainingForWallet = wallet ? cursor.next<number>() : undefined;
    const walletBalance = wallet ? cursor.nextBigint() : undefined;
    const allowance = wallet ? cursor.nextBigint() : undefined;

    return {
      status: "ready",
      data: {open, paused, mintBurn, mintsPerWallet, remainingForWallet, walletBalance, allowance},
    };
  }, [minter, token, wallet, batch.isPending, batch.error, batch.results]);
}

export type OwnedCard = CardState & {
  nextLevel: number | undefined;
  nextWeight: number | undefined;
  nextBurn: bigint | undefined;
  pending: bigint | undefined;
};

/** Every card the connected wallet holds, with what each has accrued. */
export function useOwnedCards(): ReadState<OwnedCard[]> {
  const {address: wallet} = useAccount();
  const nft = addr("nft");
  const distributor = addr("distributor");

  const balanceQuery = useReadContract({
    address: nft,
    abi: propertyNftAbi,
    functionName: "balanceOf",
    args: wallet ? [wallet] : undefined,
    query: {enabled: Boolean(nft && wallet)},
  });

  const count = Number(balanceQuery.data ?? 0n);

  const idCalls: Call[] =
    nft && wallet
      ? Array.from({length: count}, (_, i) => ({
          address: nft,
          abi: propertyNftAbi,
          functionName: "tokenOfOwnerByIndex",
          args: [wallet, BigInt(i)],
        }))
      : [];

  const idBatch = useBatch(idCalls, Boolean(nft && wallet));

  const ids = useMemo(() => {
    const cursor = new Cursor(idBatch.results);
    return Array.from({length: idCalls.length}, () => cursor.nextBigint()).filter(
      (v): v is bigint => v !== undefined,
    );
  }, [idBatch.results, idCalls.length]);

  // `nextUpgrade` reverts on a maxed card by design, so a failure there reads as
  // "already a Landmark" rather than as an error.
  const detailCalls: Call[] = nft
    ? ids.flatMap((tokenId) => [
        {address: nft, abi: propertyNftAbi, functionName: "propertyOf", args: [tokenId]},
        {address: nft, abi: propertyNftAbi, functionName: "nextUpgrade", args: [tokenId]},
      ])
    : [];

  const detailBatch = useBatch(detailCalls, Boolean(nft));

  const properties = useMemo(() => {
    const cursor = new Cursor(detailBatch.results);
    return ids.map(() => {
      const property = cursor.next<PropertyTuple>();
      const upgrade = cursor.next<readonly [number, number, bigint]>();
      return {property, upgrade};
    });
  }, [detailBatch.results, ids]);

  const pendingCalls: Call[] = distributor
    ? ids.flatMap((tokenId, i) => {
        const property = properties[i]?.property;
        if (!property) return [];
        const asset = REWARD_ASSETS[property.quarter];
        if (!asset) return [];
        return [
          {
            address: distributor,
            abi: distributorAbi,
            functionName: "pendingOf",
            args: [EDITION_ID, asset, property.quarter, tokenId, property.weight],
          },
        ];
      })
    : [];

  const pendingBatch = useBatch(pendingCalls, Boolean(distributor));

  return useMemo(() => {
    const missing: string[] = [];
    if (!nft) missing.push("NEXT_PUBLIC_NFT_ADDRESS");
    if (!distributor) missing.push("NEXT_PUBLIC_DISTRIBUTOR_ADDRESS");
    if (missing.length > 0) return unconfigured<OwnedCard[]>(missing);

    if (balanceQuery.isPending) return {status: "loading"};
    if (balanceQuery.error) return {status: "error", error: balanceQuery.error};
    if (count === 0) return {status: "ready", data: []};
    if (idBatch.isPending || detailBatch.isPending) return {status: "loading"};
    if (idBatch.error) return {status: "error", error: idBatch.error};
    if (detailBatch.error) return {status: "error", error: detailBatch.error};

    const pendingCursor = new Cursor(pendingBatch.results);
    const cards: OwnedCard[] = [];

    for (let i = 0; i < ids.length; i++) {
      const tokenId = ids[i];
      const entry = properties[i];
      if (tokenId === undefined || !entry?.property) continue;
      const p = entry.property;

      // Pending is only read where a reward asset is configured, so the cursor only
      // advances for those cards -- keeping it in step with how the batch was built.
      const hasAsset = Boolean(REWARD_ASSETS[p.quarter]);
      const pending = hasAsset ? pendingCursor.nextBigint() : undefined;

      cards.push({
        tokenId,
        quarter: p.quarter,
        level: p.level,
        weight: p.weight,
        burned: p.burned,
        owner: wallet as Address,
        nextLevel: entry.upgrade?.[0],
        nextWeight: entry.upgrade?.[1],
        nextBurn: entry.upgrade?.[2],
        pending,
      });
    }

    return {status: "ready", data: cards};
  }, [
    nft,
    distributor,
    wallet,
    count,
    ids,
    properties,
    balanceQuery.isPending,
    balanceQuery.error,
    idBatch.isPending,
    idBatch.error,
    detailBatch.isPending,
    detailBatch.error,
    pendingBatch.results,
  ]);
}

export type RewardAssetInfo = {address: Address; symbol: string; decimals: number};

/** Each quarter's reward asset, where one is configured and readable. */
export function useRewardAssets(): ReadState<(RewardAssetInfo | undefined)[]> {
  const configured = REWARD_ASSETS.some(Boolean);

  const calls: Call[] = REWARD_ASSETS.flatMap((asset) =>
    asset
      ? [
          {address: asset, abi: erc20MetadataAbi, functionName: "symbol"},
          {address: asset, abi: erc20MetadataAbi, functionName: "decimals"},
        ]
      : [],
  );

  const batch = useBatch(calls, configured);

  return useMemo(() => {
    if (!configured) {
      return unconfigured<(RewardAssetInfo | undefined)[]>(
        REWARD_ASSETS.map((_, i) => `NEXT_PUBLIC_REWARD_ASSET_Q${i + 1}`),
      );
    }
    if (batch.isPending) return {status: "loading"};
    if (batch.error) return {status: "error", error: batch.error};

    const cursor = new Cursor(batch.results);
    const out = REWARD_ASSETS.map((asset) => {
      if (!asset) return undefined;
      const symbol = cursor.next<string>();
      const decimals = cursor.next<number>();
      if (symbol === undefined || decimals === undefined) return undefined;
      return {address: asset, symbol, decimals};
    });
    return {status: "ready", data: out};
  }, [configured, batch.isPending, batch.error, batch.results]);
}

export type QuarterStanding = {
  quarter: number;
  quarterWeight: bigint;
  walletWeight: bigint;
  pendingOnCards: bigint;
  creditedToWallet: bigint;
  totalDeposited: bigint;
  totalClaimed: bigint;
  reserve: bigint;
  /** True when any figure in this row failed to read, so the row is not shown as whole. */
  incomplete: boolean;
};

/** A wallet's standing in each quarter. */
export function useQuarterStandings(): ReadState<QuarterStanding[]> {
  const {address: wallet} = useAccount();
  const distributor = addr("distributor");
  const owned = useOwnedCards();

  const calls: Call[] = distributor
    ? QUARTERS.flatMap((q) => {
        const asset = REWARD_ASSETS[q];
        const rows: Call[] = [
          {address: distributor, abi: distributorAbi, functionName: "quarterWeight", args: [EDITION_ID, q]},
        ];
        if (!asset) return rows;
        rows.push(
          {address: distributor, abi: distributorAbi, functionName: "totalDeposited", args: [EDITION_ID, asset, q]},
          {address: distributor, abi: distributorAbi, functionName: "totalClaimed", args: [EDITION_ID, asset, q]},
          {address: distributor, abi: distributorAbi, functionName: "reserveOf", args: [EDITION_ID, asset, q]},
        );
        if (wallet) {
          rows.push({
            address: distributor,
            abi: distributorAbi,
            functionName: "creditedOf",
            args: [EDITION_ID, asset, q, wallet],
          });
        }
        return rows;
      })
    : [];

  const batch = useBatch(calls, Boolean(distributor));

  return useMemo(() => {
    if (!distributor) return unconfigured<QuarterStanding[]>(["NEXT_PUBLIC_DISTRIBUTOR_ADDRESS"]);
    if (batch.isPending) return {status: "loading"};
    if (batch.error) return {status: "error", error: batch.error};
    if (owned.status === "loading") return {status: "loading"};
    if (owned.status === "error") return {status: "error", error: owned.error};

    const ownedCards = owned.status === "ready" ? owned.data : [];
    const cursor = new Cursor(batch.results);
    const rows: QuarterStanding[] = [];

    for (const q of QUARTERS) {
      const quarterWeight = cursor.nextBigint();
      const hasAsset = Boolean(REWARD_ASSETS[q]);
      const totalDeposited = hasAsset ? cursor.nextBigint() : 0n;
      const totalClaimed = hasAsset ? cursor.nextBigint() : 0n;
      const reserve = hasAsset ? cursor.nextBigint() : 0n;
      const creditedToWallet = hasAsset && wallet ? cursor.nextBigint() : 0n;

      const inQuarter = ownedCards.filter((c) => c.quarter === q);
      const pendingReadFailed = inQuarter.some((c) => c.pending === undefined);

      rows.push({
        quarter: q,
        quarterWeight: quarterWeight ?? 0n,
        walletWeight: inQuarter.reduce((sum, c) => sum + BigInt(c.weight), 0n),
        pendingOnCards: inQuarter.reduce((sum, c) => sum + (c.pending ?? 0n), 0n),
        creditedToWallet: creditedToWallet ?? 0n,
        totalDeposited: totalDeposited ?? 0n,
        totalClaimed: totalClaimed ?? 0n,
        reserve: reserve ?? 0n,
        incomplete:
          quarterWeight === undefined ||
          (hasAsset &&
            (totalDeposited === undefined ||
              totalClaimed === undefined ||
              reserve === undefined ||
              (Boolean(wallet) && creditedToWallet === undefined))) ||
          pendingReadFailed,
      });
    }

    return {status: "ready", data: rows};
  }, [distributor, wallet, batch.isPending, batch.error, batch.results, owned]);
}

export type ProtocolStats = {
  tokenSupply: bigint;
  tokenMaxSupply: bigint;
  cardsMinted: bigint;
  perQuarterMinted: bigint[];
  perQuarterWeight: bigint[];
  editionWeight: bigint;
  protocolWeight: bigint;
  feeRouterPending: bigint | undefined;
  treasuryLiability: bigint | undefined;
  streamReleasable: bigint | undefined;
  streamUnmatured: bigint | undefined;
  vaultUnallocated: bigint | undefined;
  vaultPerQuarterPending: (bigint | undefined)[];
  depositedPerQuarter: (bigint | undefined)[];
  claimedPerQuarter: (bigint | undefined)[];
};

/** Everything the stats page shows, read live. */
export function useProtocolStats(): ReadState<ProtocolStats> {
  const token = addr("token");
  const nft = addr("nft");
  const distributor = addr("distributor");
  const feeRouter = addr("feeRouter");
  const streamVault = addr("streamVault");
  const revenueVault = addr("revenueVault");

  const calls: Call[] = [];
  if (token) {
    calls.push(
      {address: token, abi: tokenAbi, functionName: "totalSupply"},
      {address: token, abi: tokenAbi, functionName: "MAX_SUPPLY"},
    );
  }
  if (nft) {
    calls.push({address: nft, abi: propertyNftAbi, functionName: "totalSupply"});
    for (const q of QUARTERS) {
      calls.push({address: nft, abi: propertyNftAbi, functionName: "mintedInQuarter", args: [q]});
    }
  }
  if (distributor) {
    for (const q of QUARTERS) {
      calls.push({
        address: distributor,
        abi: distributorAbi,
        functionName: "quarterWeight",
        args: [EDITION_ID, q],
      });
    }
    calls.push(
      {address: distributor, abi: distributorAbi, functionName: "editionWeight", args: [EDITION_ID]},
      {address: distributor, abi: distributorAbi, functionName: "protocolWeight"},
    );
  }
  if (feeRouter) {
    calls.push(
      {address: feeRouter, abi: feeRouterAbi, functionName: "distributable"},
      {address: feeRouter, abi: feeRouterAbi, functionName: "treasuryLiability"},
    );
  }
  if (streamVault) {
    calls.push(
      {address: streamVault, abi: streamVaultAbi, functionName: "releasable"},
      {address: streamVault, abi: streamVaultAbi, functionName: "unmatured"},
    );
  }
  if (revenueVault) {
    calls.push({address: revenueVault, abi: revenueVaultAbi, functionName: "unallocated"});
    for (const q of QUARTERS) {
      calls.push({
        address: revenueVault,
        abi: revenueVaultAbi,
        functionName: "quarterPending",
        args: [EDITION_ID, q],
      });
    }
  }
  if (distributor) {
    for (const q of QUARTERS) {
      const asset = REWARD_ASSETS[q];
      if (!asset) continue;
      calls.push(
        {address: distributor, abi: distributorAbi, functionName: "totalDeposited", args: [EDITION_ID, asset, q]},
        {address: distributor, abi: distributorAbi, functionName: "totalClaimed", args: [EDITION_ID, asset, q]},
      );
    }
  }

  const batch = useBatch(calls, Boolean(token && nft && distributor));

  return useMemo(() => {
    const missing: string[] = [];
    if (!token) missing.push("NEXT_PUBLIC_TOKEN_ADDRESS");
    if (!nft) missing.push("NEXT_PUBLIC_NFT_ADDRESS");
    if (!distributor) missing.push("NEXT_PUBLIC_DISTRIBUTOR_ADDRESS");
    if (missing.length > 0) return unconfigured<ProtocolStats>(missing);
    if (batch.isPending) return {status: "loading"};
    if (batch.error) return {status: "error", error: batch.error};

    const cursor = new Cursor(batch.results);
    const tokenSupply = cursor.nextBigint();
    const tokenMaxSupply = cursor.nextBigint();
    const cardsMinted = cursor.nextBigint();
    const perQuarterMinted = QUARTERS.map(() => cursor.nextBigint() ?? 0n);
    const perQuarterWeight = QUARTERS.map(() => cursor.nextBigint() ?? 0n);
    const editionWeight = cursor.nextBigint();
    const protocolWeight = cursor.nextBigint();

    const feeRouterPending = feeRouter ? cursor.nextBigint() : undefined;
    const treasuryLiability = feeRouter ? cursor.nextBigint() : undefined;
    const streamReleasable = streamVault ? cursor.nextBigint() : undefined;
    const streamUnmatured = streamVault ? cursor.nextBigint() : undefined;
    const vaultUnallocated = revenueVault ? cursor.nextBigint() : undefined;
    const vaultPerQuarterPending = QUARTERS.map(() =>
      revenueVault ? cursor.nextBigint() : undefined,
    );

    const depositedPerQuarter: (bigint | undefined)[] = [];
    const claimedPerQuarter: (bigint | undefined)[] = [];
    for (const q of QUARTERS) {
      if (!REWARD_ASSETS[q]) {
        depositedPerQuarter.push(undefined);
        claimedPerQuarter.push(undefined);
        continue;
      }
      depositedPerQuarter.push(cursor.nextBigint());
      claimedPerQuarter.push(cursor.nextBigint());
    }

    // These five are the page. If any failed, the page failed -- it does not render a
    // partial picture as though it were whole.
    if (
      tokenSupply === undefined ||
      tokenMaxSupply === undefined ||
      cardsMinted === undefined ||
      editionWeight === undefined ||
      protocolWeight === undefined
    ) {
      return {status: "error", error: new Error("One or more contract reads did not return a value.")};
    }

    return {
      status: "ready",
      data: {
        tokenSupply,
        tokenMaxSupply,
        cardsMinted,
        perQuarterMinted,
        perQuarterWeight,
        editionWeight,
        protocolWeight,
        feeRouterPending,
        treasuryLiability,
        streamReleasable,
        streamUnmatured,
        vaultUnallocated,
        vaultPerQuarterPending,
        depositedPerQuarter,
        claimedPerQuarter,
      },
    };
  }, [token, nft, distributor, feeRouter, streamVault, revenueVault, batch.isPending, batch.error, batch.results]);
}

/** Whether building is currently possible. */
export function useBuildPaused(): ReadState<boolean> {
  const manager = addr("progressionManager");
  const query = useReadContract({
    address: manager,
    abi: progressionManagerAbi,
    functionName: "paused",
    query: {enabled: Boolean(manager)},
  });

  return useMemo(() => {
    if (!manager) return unconfigured<boolean>(["NEXT_PUBLIC_PROGRESSION_MANAGER_ADDRESS"]);
    if (query.isPending) return {status: "loading"};
    if (query.error) return {status: "error", error: query.error};
    if (query.data === undefined) return {status: "loading"};
    return {status: "ready", data: query.data as boolean};
  }, [manager, query.isPending, query.error, query.data]);
}
