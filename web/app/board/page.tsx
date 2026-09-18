import type {Metadata} from "next";
import {BRAND, EDITION} from "@/lib/brand";
import {BoardView} from "@/components/BoardView";

export const metadata: Metadata = {
  title: "The Board",
  description: `The complete ${EDITION.cardSupply}-card register, browsable by ${BRAND.groupTerm.toLowerCase()}.`,
};

export default function BoardPage() {
  return <BoardView />;
}
