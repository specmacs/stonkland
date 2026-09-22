import type {Metadata} from "next";
import Link from "next/link";
import {BRAND} from "@/lib/brand";
import {PageHeader} from "@/components/Section";

export const metadata: Metadata = {
  title: "Terms",
  robots: {index: false},
};

/**
 * Deliberately not drafted here.
 *
 * Terms are a blocking launch item that needs securities counsel, and counsel needs the
 * full mechanics: fee capture, weight-based distribution, and the fact that a larger
 * share requires a larger burn. Plausible-looking terms written by anyone else are worse
 * than none, because somebody will rely on them. The structure below is what counsel is
 * being asked to fill, and the page says so.
 */
export default function TermsPage() {
  return (
    <>
      <PageHeader
        heading="Terms of service"
        sub="Not yet published. This page is a placeholder and creates no agreement between anyone."
      />

      <div className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
        <div className="panel border-seal p-5">
          <p className="text-sm leading-relaxed text-ink">
            {BRAND.projectName} has no terms of service in force. Nothing on this site should be
            read as a contract, an offer, or a representation about how the protocol will be
            operated. Until counsel has reviewed and published terms here, treat this deployment
            as a work in progress.
          </p>
        </div>

        <h2 className="mt-10 text-lg font-semibold text-ink">What still has to be settled</h2>
        <ul className="mt-4 space-y-3">
          {[
            "Which jurisdictions are served, and which are blocked, with the geoblocking implemented to match.",
            "The legal characterisation of the token, the cards, and the reward assets, reviewed by securities counsel with the full mechanics in front of them.",
            "The acceptable-use, disclaimer, and limitation-of-liability language that any published terms would carry.",
            "How disputes are handled, and under whose law.",
          ].map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed text-inkMuted">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-inkFaint" />
              {item}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-inkMuted">
          In the meantime, the{" "}
          <Link href="/rulebook" className="text-seal underline underline-offset-4">
            rulebook
          </Link>{" "}
          describes exactly how the protocol behaves, including the parts that carry risk.
        </p>
      </div>
    </>
  );
}
