"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/login", { method: "DELETE" });
        router.push("/login");
        router.refresh();
      }}
      className="text-xs text-neutral-400 hover:text-neutral-700"
    >
      Sign out
    </button>
  );
}
