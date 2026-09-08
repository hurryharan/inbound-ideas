import { NavLink } from "@/components/nav-link";
import { SignOutButton } from "@/components/sign-out-button";

const NAV_ITEMS = [
  { href: "/inbox", label: "Inbox" },
  { href: "/ideas", label: "Ideas" },
  { href: "/sessions", label: "Sessions" },
  { href: "/sources", label: "Sources" },
  { href: "/context", label: "Context" },
  { href: "/llm", label: "LLM" },
  { href: "/usage", label: "Usage" },
  { href: "/settings", label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-200 bg-neutral-100 px-3 py-4">
        <div className="px-2 pb-4">
          <p className="text-sm font-semibold tracking-tight text-neutral-900">Inbound Ideas</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-2 pt-4">
          <SignOutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
