import { requireFeaturePage } from "@/lib/authz";

export default async function DocMakerLayout({ children }: { children: React.ReactNode }) {
  await requireFeaturePage("doc_maker");
  return children;
}
