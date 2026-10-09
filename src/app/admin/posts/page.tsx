import Link from "next/link";
import { listAllPosts } from "@/content/service";
import { getDb } from "@/db/client";
import { tierLabel } from "@/components/post-card";

export const metadata = { title: "Admin · Posts" };

export default async function AdminPostsPage() {
  const posts = await listAllPosts(getDb());
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Posts</h1>
        <Link
          href="/admin/posts/new"
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900"
        >
          New post
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-400">
          <tr>
            <th className="py-2">Title</th>
            <th>Tier</th>
            <th>Media</th>
            <th>Status</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} className="border-t border-zinc-800">
              <td className="py-2">
                <Link href={`/admin/posts/${p.id}`} className="underline">
                  {p.title}
                </Link>
              </td>
              <td>{tierLabel(p)}</td>
              <td>
                {p.media.filter((m) => m.status === "ready").length}/{p.media.length}
              </td>
              <td>{p.status}</td>
              <td className="text-zinc-400">
                {(p.publishedAt ?? p.publishAt ?? p.createdAt)
                  .toISOString()
                  .slice(0, 16)
                  .replace("T", " ")}
              </td>
            </tr>
          ))}
          {posts.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-zinc-500">
                No posts yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
