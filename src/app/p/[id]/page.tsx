import Link from "next/link";
import { notFound } from "next/navigation";
import { loadViewerContext, resolveAccess } from "@/access/entitlements";
import { requestMeta, requireVerifiedUser } from "@/auth/session";
import { issueViewGrants, previewUrl } from "@/content/playback";
import { getPost } from "@/content/service";
import { getDb } from "@/db/client";
import { getImageStorage, getVideoProvider } from "@/media";
import { MediaViewer } from "@/components/media-viewer";
import { SubscribeButton, TipForm, UnlockButton } from "@/components/pay-buttons";
import { tierLabel } from "@/components/post-card";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireVerifiedUser(`/p/${id}`);
  const db = getDb();
  const now = new Date();
  const post = await getPost(db, id);
  if (!post) notFound();
  const ctx = await loadViewerContext(db, user, now);
  const access = resolveAccess(ctx, post, now);
  if (!access.allowed && access.reason === "not_published") notFound();
  const storage = getImageStorage();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{post.title}</h1>
        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs">{tierLabel(post)}</span>
      </div>
      {post.status !== "published" && user.role === "admin" && (
        <p className="mb-4 rounded border border-amber-900 bg-amber-950 px-3 py-2 text-xs text-amber-200">
          Admin preview: this post is {post.status}
          {post.publishAt ? ` for ${post.publishAt.toISOString()}` : ""}.
        </p>
      )}

      {access.allowed ? (
        <Unlocked postId={post.id} />
      ) : (
        <Locked
          reason={access.reason}
          label={tierLabel(post)}
          postId={post.id}
          previews={post.media
            .filter((m) => m.status === "ready")
            .map((m) => previewUrl(storage, m, now))}
        />
      )}

      {post.caption && (
        <p className="mt-6 whitespace-pre-wrap text-sm text-zinc-300">{post.caption}</p>
      )}
      {access.allowed && user.role !== "admin" && (
        <div className="mt-6 border-t border-zinc-800 pt-4">
          <TipForm postId={post.id} />
        </div>
      )}
      <p className="mt-6 text-sm">
        <Link href="/feed" className="underline">
          Back to feed
        </Link>
      </p>
    </main>
  );

  async function Unlocked({ postId }: { postId: string }) {
    const meta = await requestMeta();
    const grants = await issueViewGrants(
      db,
      { video: getVideoProvider(), storage },
      { user, items: post!.media, ipPrefix: meta.ipPrefix },
      now,
    );
    void postId;
    if (grants.items.length === 0)
      return <p className="text-sm text-zinc-400">Media is still processing.</p>;
    return <MediaViewer initial={grants.items} watermark={grants.watermark} />;
  }
}

function Locked({
  reason,
  label,
  postId,
  previews,
}: {
  reason: string;
  label: string;
  postId: string;
  previews: (string | null)[];
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="grid grid-cols-2 gap-1 opacity-70">
        {previews.slice(0, 4).map((url, i) =>
          url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed, expiring URL
            <img
              key={i}
              src={url}
              alt=""
              draggable={false}
              className="aspect-square w-full object-cover blur-md"
            />
          ) : (
            <div key={i} className="aspect-square w-full bg-zinc-800" />
          ),
        )}
        {previews.length === 0 && <div className="col-span-2 aspect-video bg-zinc-800" />}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 p-6 text-center">
        <span className="text-3xl">🔒</span>
        <div className="w-full max-w-xs">
          {reason === "purchase_required" ? (
            <UnlockButton postId={postId} label={`Unlock for ${label}`} />
          ) : (
            <SubscribeButton label="Subscribe to view" />
          )}
        </div>
      </div>
    </div>
  );
}
