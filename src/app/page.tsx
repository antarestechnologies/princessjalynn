import Link from "next/link";
import { getCurrentUser } from "@/auth/session";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        {user ? (
          <p className="mt-2 text-sm text-zinc-400">
            Signed in as @{user.handle}.{" "}
            <Link href="/account" className="underline">
              Your account
            </Link>
            . Content arrives in Phase 3.
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-400">
            <Link href="/signup" className="underline">
              Create an account
            </Link>{" "}
            or{" "}
            <Link href="/login" className="underline">
              sign in
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
