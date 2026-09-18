import type {Metadata} from "next";
import {BRAND, EDITION} from "@/lib/brand";
import {MintFlow} from "@/components/MintFlow";

export const metadata: Metadata = {
  title: "Mint",
  description: `Burn ${EDITION.mintBurn.toLocaleString("en-US")} ${BRAND.tokenTicker} and take a permanent place on the board.`,
};

export default function MintPage() {
  return <MintFlow />;
}
