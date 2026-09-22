import type {Metadata} from "next";
import {BRAND, EDITION} from "@/lib/brand";
import {CardPage} from "@/components/CardPage";

export const metadata: Metadata = {
  title: BRAND.itemName,
  description: `One ${BRAND.itemName.toLowerCase()} of ${EDITION.cardSupply}, with its level, weight, lifetime burn and owner read from chain.`,
};

/**
 * A card's own page.
 *
 * Every id in the edition resolves, minted or not, because these links are shared and
 * followed from outside: a marketplace listing, a post, a wallet. An id that names
 * nothing yet gets a page that says so, rather than a 404 that leaves the reader
 * unsure whether the card exists or the site is broken.
 */
export function generateStaticParams() {
  return Array.from({length: EDITION.cardSupply}, (_, i) => ({id: String(i + 1)}));
}

export default async function BoardCardPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <CardPage id={id} />;
}
