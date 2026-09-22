import type {Metadata} from "next";
import {BRAND} from "@/lib/brand";
import {PageHeader} from "@/components/Section";

export const metadata: Metadata = {
  title: "Privacy",
  robots: {index: false},
};

/**
 * A privacy policy is a blocking launch item. What this page can honestly say today is
 * how the site is actually built, which is a short list, and that is worth stating even
 * before the formal policy exists.
 */
export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        heading="Privacy"
        sub="A formal policy has not been published yet. What this site does today is described below."
      />

      <div className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
        <div className="panel border-seal p-5">
          <p className="text-sm leading-relaxed text-ink">
            {BRAND.projectName} has no published privacy policy in force. This page describes how
            the interface is built, which is accurate, but it is not a substitute for the policy
            that has to be published before launch.
          </p>
        </div>

        <h2 className="mt-10 text-lg font-semibold text-ink">How this interface works</h2>
        <ul className="mt-4 space-y-3">
          {[
            "There is no backend and no database. This site is static files plus calls your browser makes directly to a blockchain RPC endpoint.",
            "No account is created and no email, name, or password is collected.",
            "Connecting a wallet shares your address with this page so it can read your cards and balances. That address is used in the browser and is not transmitted to any server operated by this project.",
            "The RPC provider configured for this deployment will see the requests your browser makes, including your address when it is part of a query. That provider has its own policies.",
            "Wallet software you choose to connect has its own policies, which this project does not control.",
            "There is no analytics script, no advertising pixel, and no third-party tracker on this site.",
          ].map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed text-inkMuted">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-inkFaint" />
              {item}
            </li>
          ))}
        </ul>

        <h2 className="mt-10 text-lg font-semibold text-ink">What a blockchain keeps</h2>
        <p className="mt-4 text-sm leading-relaxed text-inkMuted">
          Every mint, build, transfer, and claim is a public transaction, permanently readable by
          anyone, and neither this project nor anyone else can delete or amend it. That is a
          property of the chain rather than a choice this site makes, and it is worth
          understanding before you transact.
        </p>
      </div>
    </>
  );
}
