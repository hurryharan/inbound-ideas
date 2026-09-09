"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/settings", label: "General" },
  { href: "/context", label: "Context" },
  { href: "/llm", label: "LLM" },
  { href: "/usage", label: "Usage" },
];

/** Shared sub-navigation for Settings-only sections. */
export function SettingsSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 border-b border-neutral-200 pb-4">
      {SECTIONS.map((s) => {
        const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
