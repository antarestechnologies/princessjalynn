import Link from "next/link";
import { notFound } from "next/navigation";
import { posterUrl } from "@/content/playback";
import { getPost, syncVideoStatus } from "@/content/service";
import { getDb } from "@/db/client";
import { getImageStorage, getVideoProvider } from "@/media";
import { Button } from "@/components/ui";
import {
  deleteMediaAction,
  unlinkPerformerAction,
  unpublishPostAction,
  updatePostAction,
} from "../actions";
import { MediaUploader } from "../media-uploader";
import { PostForm } from "../post-form";
import { PublishControls } from "./publish-controls";
import { LinkPerformerForm } from "./link-performer";
import { linksForMedia, verifiedPerformerOptions } from "@/compliance/vault";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  let post = await getPost(db, id);
  if (!post) notFound();

  // Pull fresh status for any video still processing, then re-read.
  const pending = post.media.filter(
    (m) => m.kind === "video" && m.status !== "ready" && m.status !== "failed",
  );
  if (pending.length) {
    await Promise.all(
      pending.map((m) =>
        syncVideoStatus(db, getVideoProvider(), getImageStorage(), m.id).catch(() => null),
      ),
    );
    post = (await getPost(db, id))!;
  }
  const storage = getImageStorage();
  const ready = post.media.filter((m) => m.status === "ready").length;
  const [links, performerOptions] = await Promise.all([
    linksForMedia(
      db,
      post.media.map((m) => m.id),
    ),
    verifiedPerformerOptions(db),
  ]);
  const unlinked = post.media.filter(
    (m) => !links.some((l) => l.mediaId === m.id && l.status === "verified"),
  ).length;

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{post.title}</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded bg-zinc-800 px-2 py-0.5">{post.status}</span>
          <Link href={`/p/${post.id}`} className="underline">
            Preview
          </Link>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Details
        </h2>
        <PostForm action={updatePostAction} post={post} submitLabel="Save" />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Media</h2>
        <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {post.media.map((m) => {
            const url = posterUrl(storage, m);
            return (
              <div
                key={m.id}
                className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
              >
                <div className="aspect-square">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URL
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                      {m.kind === "video" ? `video · ${m.status}` : m.status}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between px-2 py-1 text-[11px] text-zinc-400">
                  <span>
                    {m.kind} · {m.status}
                  </span>
                  <form action={deleteMediaAction}>
                    <input type="hidden" name="mediaId" value={m.id} />
                    <input type="hidden" name="postId" value={post!.id} />
                    <button type="submit" className="text-red-400 hover:underline">
                      delete
                    </button>
                  </form>
                </div>
                <div className="space-y-1 border-t border-zinc-800 px-2 py-2 text-[11px]">
                  <div className="font-semibold text-zinc-400">2257</div>
                  {links
                    .filter((l) => l.mediaId === m.id)
                    .map((l) => (
                      <div key={l.id} className="flex items-center justify-between">
                        <span
                          className={
                            l.status === "verified" ? "text-emerald-300" : "text-amber-300"
                          }
                        >
                          {l.stageName} · {l.productionDate}
                        </span>
                        <form action={unlinkPerformerAction}>
                          <input type="hidden" name="linkId" value={l.id} />
                          <input type="hidden" name="postId" value={post!.id} />
                          <button type="submit" className="text-zinc-500 hover:underline">
                            unlink
                          </button>
                        </form>
                      </div>
                    ))}
                  {!links.some((l) => l.mediaId === m.id) && (
                    <div className="text-amber-300">Not linked: cannot publish</div>
                  )}
                  <LinkPerformerForm
                    mediaId={m.id}
                    postId={post!.id}
                    performers={performerOptions}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <MediaUploader postId={post.id} postTitle={post.title} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Publishing
        </h2>
        {unlinked > 0 && (
          <p className="mb-3 text-sm text-amber-300">
            {unlinked} media item(s) are not linked to a verified 2257 record. Publishing is blocked
            until every item is linked.
          </p>
        )}
        <PublishControls postId={post.id} status={post.status} readyCount={ready} />
        {(post.status === "published" || post.status === "scheduled") && (
          <div className="mt-4 flex max-w-md gap-3">
            <form action={unpublishPostAction} className="flex-1">
              <input type="hidden" name="id" value={post.id} />
              <input type="hidden" name="to" value="draft" />
              <Button variant="secondary">Unpublish to draft</Button>
            </form>
            <form action={unpublishPostAction} className="flex-1">
              <input type="hidden" name="id" value={post.id} />
              <input type="hidden" name="to" value="archived" />
              <Button variant="danger">Archive</Button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
