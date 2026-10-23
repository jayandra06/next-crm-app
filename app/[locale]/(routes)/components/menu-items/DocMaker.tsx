import { PenLine } from "lucide-react";
import type { NavItem } from "../nav-main";

export default function getDocMakerMenuItem({ title }: { title: string }): NavItem {
  return { title, url: "/doc-maker", icon: PenLine };
}
