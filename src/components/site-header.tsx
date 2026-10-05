import Link from "next/link";
import { signOutAction } from "@/auth/actions";
import { getCurrentUser } from "@/auth/session";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3 text-sm">
      <Link href="/" className="font-semibold tracking-tight">
        Members
      </Link>
      <nav className="flex items-center gap-4 text-zinc-300">
        {user ? (
          <>
            <Link href="/account">@{user.handle}</Link>
            <form action={signOutAction}>
              <button type="submit" className="hover:text-white">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login">Sign in</Link>
            <Link href="/signup" className="rounded-md bg-zinc-100 px-3 py-1 text-zinc-900">
              Join
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
