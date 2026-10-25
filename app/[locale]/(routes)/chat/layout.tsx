import { requireFeaturePage } from "@/lib/authz";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeaturePage("chat");
  return (
    <div data-chat-shell className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}
