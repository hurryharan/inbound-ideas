"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
  activePaths = [],
}: {
  href: string;
  children: ReactNode;
  /** Extra route prefixes that should also count as "active" for this link. */
  activePaths?: string[];
}) {
  const pathname = usePathname();
  const isMatch = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const active = isMatch(href) || activePaths.some(isMatch);

  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-neutral-900 text-white"
          : "text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
      }`}
    >
      {children}
    </Link>
  );
}
