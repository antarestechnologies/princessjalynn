import Link from "next/link";
import type { Access } from "@/access/entitlements";
import type { PostWithMedia } from "@/content/service";

export function formatPrice(cents: number | null, currency = "USD") {
  if (cents == null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function tierLabel(post: { tier: string; priceCents: number | null; currency: string }) {
  if (post.tier === "free") return "Free";
  if (post.tier === "subscriber") return "Subscribers";
  return formatPrice(post.priceCents, post.currency);
}

export function PostCard({
  post,
  access,
  coverUrl,
}: {
  post: PostWithMedia;
  access: Access;
  coverUrl: string | null;
}) {
  const locked = !access.allowed;
  const count = post.media.filter((m) => m.status === "ready").length;
  return (
    <Link
      href={`/p/${post.id}`}
      className="group block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
    >
      <div className="relative aspect-[4/5] bg-zinc-950">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, expiring URL
          <img
            src={coverUrl}
            alt=""
            draggable={false}
            className={`h-full w-full object-cover ${locked ? "scale-105 blur-sm" : ""}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600">
            {post.media.some((m) => m.kind === "video") ? "▶" : "·"}
          </div>
        )}
        {locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 text-sm">
            <span className="text-2xl">🔒</span>
            <span>{tierLabel(post)}</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs">
          {tierLabel(post)}
        </span>
        <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs">
          {count} item{count === 1 ? "" : "s"}
        </span>
      </div>
      <div className="p-3">
        <h2 className="truncate text-sm font-medium group-hover:underline">{post.title}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {(post.publishedAt ?? post.publishAt ?? post.createdAt).toLocaleDateString("en-US")}
        </p>
      </div>
    </Link>
  );
}
