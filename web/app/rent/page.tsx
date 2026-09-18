import type {Metadata} from "next";
import {BRAND} from "@/lib/brand";
import {GroundRent} from "@/components/GroundRent";

export const metadata: Metadata = {
  title: BRAND.rewardsPageTerm,
  description: `Your ${BRAND.groupTerm.toLowerCase()} scoreboard and claims.`,
};

export default function RentPage() {
  return <GroundRent />;
}
