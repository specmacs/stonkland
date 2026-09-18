import type {Metadata} from "next";
import {BRAND} from "@/lib/brand";
import {MyCards} from "@/components/MyCards";

export const metadata: Metadata = {
  title: "My cards",
  description: `Every card you hold, with its level, weight, lifetime burn, and pending ${BRAND.rewardsPageTerm.toLowerCase()}.`,
};

export default function CardsPage() {
  return <MyCards />;
}
