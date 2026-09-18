"use client";

import {useReadContracts} from "wagmi";
import type {Abi, Address} from "viem";

/**
 * One typed boundary for batched contract reads.
 *
 * wagmi infers return types per call, which works beautifully for a homogeneous batch and
 * fights you for a mixed one. Every read in this interface is decoded explicitly anyway --
 * a value only counts once its own read has succeeded -- so inference across a mixed batch
 * buys nothing and costs a great deal. This narrows once, here, and everything downstream
 * checks each result on its own.
 */
export type Call = {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
};

export type CallResult =
  | {status: "success"; result: unknown}
  | {status: "failure"; error: Error};

export type BatchState = {
  isPending: boolean;
  error: Error | null;
  results: readonly CallResult[] | undefined;
};

export function useBatch(calls: readonly Call[], enabled = true): BatchState {
  const query = useReadContracts({
    allowFailure: true,
    contracts: calls as never,
    query: {enabled: enabled && calls.length > 0},
  });

  return {
    isPending: calls.length === 0 ? false : query.isPending,
    error: query.error ?? null,
    results: calls.length === 0 ? [] : (query.data as readonly CallResult[] | undefined),
  };
}

/** A successful result, or undefined. Never a substituted default. */
export function value<T>(results: readonly CallResult[] | undefined, index: number): T | undefined {
  const entry = results?.[index];
  return entry?.status === "success" ? (entry.result as T) : undefined;
}

/** Reads results in order, so a batch can be decoded the way it was built. */
export class Cursor {
  private index = 0;

  constructor(private readonly results: readonly CallResult[] | undefined) {}

  next<T>(): T | undefined {
    const out = value<T>(this.results, this.index);
    this.index += 1;
    return out;
  }

  /** Advances past `count` entries without reading them. */
  skip(count: number): void {
    this.index += count;
  }

  nextBigint(): bigint | undefined {
    const raw = this.next<bigint | number>();
    if (raw === undefined) return undefined;
    return typeof raw === "bigint" ? raw : BigInt(raw);
  }
}
