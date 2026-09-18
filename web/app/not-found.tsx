import Link from "next/link";
import {BRAND, EDITION} from "@/lib/brand";
import {Mark} from "@/components/Mark";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start px-4 py-24 sm:px-6">
      <Mark className="h-10 w-10 text-brass-500" />
      <p className="rule-label mt-6">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-100 sm:text-4xl">
        This plot is not on the board.
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-ink-400">
        There are {EDITION.cardSupply} {BRAND.itemName.toLowerCase()}s across four{" "}
        {BRAND.groupTermPlural.toLowerCase()}, and whatever you were looking for is not one of
        them.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/board" className="btn-primary">
          Enter the board
        </Link>
        <Link href="/" className="btn-secondary">
          Back to the start
        </Link>
      </div>
    </div>
  );
}
