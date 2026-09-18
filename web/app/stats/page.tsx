import type {Metadata} from "next";
import {Stats} from "@/components/Stats";

export const metadata: Metadata = {
  title: "Stats",
  description: "Read directly from the contracts. Nothing here is cached or estimated.",
};

export default function StatsPage() {
  return <Stats />;
}
