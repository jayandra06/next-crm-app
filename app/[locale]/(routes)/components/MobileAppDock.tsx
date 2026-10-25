"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-main";

const PREFERRED = ["/", "/crm", "/emails", "/chat"];

function stripLocale(pathname: string) {
  return pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
}

function isActive(url: string, pathname: string) {
  const path = stripLocale(pathname);
  if (url === "/") return path === "/";
  if (url.startsWith("/crm")) return path.startsWith("/crm");
  return path === url || path.startsWith(`${url}/`);
}

function dockItems(items: NavItem[]) {
  const flat = items.flatMap((item) => {
    if (item.url && item.icon) return [{ title: item.title, url: item.url, icon: item.icon }];
    const first = item.items?.[0];
    if (first && item.icon) return [{ title: item.title, url: first.url, icon: item.icon }];
    return [];
  });

  const primary = PREFERRED.map((prefix) =>
    flat.find((item) => (prefix === "/" ? item.url === "/" : item.url.startsWith(prefix)))
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const rest = flat.filter((item) => !primary.some((picked) => picked.url === item.url));
  return [...primary, ...rest].slice(0, 4);
}

export function MobileAppDock({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { toggleSidebar, setOpenMobile } = useSidebar();
  const links = dockItems(items);

  return (
    <>
      <nav
        aria-label="Primary"
        className="mobile-app-dock pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.55rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <div className="pointer-events-auto flex w-full max-w-md items-stretch gap-1 rounded-2xl border border-border/70 bg-background/90 p-1 shadow-lg shadow-black/10 backdrop-blur-xl">
          {links.map((item) => {
            const active = isActive(item.url, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.url}
                href={item.url}
                onClick={() => setOpenMobile(false)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-none",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="max-w-full truncate">{item.title}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className="mobile-menu-fab flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-none text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            aria-label="Open navigation"
            onClick={toggleSidebar}
          >
            <Menu className="h-4 w-4 shrink-0" />
            <span>Menu</span>
          </button>
        </div>
      </nav>
    </>
  );
}
