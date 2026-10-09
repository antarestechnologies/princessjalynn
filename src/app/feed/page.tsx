import { loadViewerContext, resolveAccess } from "@/access/entitlements";
import { requireVerifiedUser } from "@/auth/session";
import { posterUrl, previewUrl } from "@/content/playback";
import { FEED_PAGE_SIZE, listPublishedPosts } from "@/content/service";
import Link from "next/link";
import { compliantMediaIds } from "@/compliance/vault";
import { getDb } from "@/db/client";
import { getImageStorage } from "@/media";
import { PostCard } from "@/components/post-card";

export const metadata = { title: "Feed" };

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireVerifiedUser("/feed");
  const page = Math.min(1000, Math.max(1, Number((await searchParams).page) || 1));
  const db = getDb();
  const now = new Date();
  // Fetch one extra row to know whether an older page exists.
  const [ctx, rows] = await Promise.all([
    loadViewerContext(db, user, now),
    listPublishedPosts(db, now, { limit: FEED_PAGE_SIZE + 1, offset: (page - 1) * FEED_PAGE_SIZE }),
  ]);
  const hasOlder = rows.length > FEED_PAGE_SIZE;
  const posts = rows.slice(0, FEED_PAGE_SIZE);
  const storage = getImageStorage();
  const ok = await compliantMediaIds(
    db,
    posts.flatMap((p) => p.media.map((m) => m.id)),
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Feed</h1>
      {posts.length === 0 && <p className="text-sm text-zinc-400">Nothing posted yet.</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {posts.map((post) => {
          const access = resolveAccess(ctx, post, now);
          const cover = post.media.find((m) => m.status === "ready" && ok.has(m.id));
          const coverUrl = cover
            ? access.allowed
              ? posterUrl(storage, cover, now)
              : previewUrl(storage, cover, now)
            : null;
          return <PostCard key={post.id} post={post} access={access} coverUrl={coverUrl} />;
        })}
      </div>
      <nav className="mt-8 flex justify-between text-sm">
        {page > 1 ? (
          <Link href={page === 2 ? "/feed" : `/feed?page=${page - 1}`} className="underline">
            Newer
          </Link>
        ) : (
          <span />
        )}
        {hasOlder && (
          <Link href={`/feed?page=${page + 1}`} className="underline">
            Older
          </Link>
        )}
      </nav>
    </main>
  );
}
