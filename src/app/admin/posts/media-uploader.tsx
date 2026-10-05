"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import * as tus from "tus-js-client";
import { Alert } from "@/components/ui";
import { startVideoUploadAction, syncVideoAction } from "./actions";

/**
 * Admin uploader. Images go to our image route (re-encoded + blurred server-side). Videos ask
 * the server for upload instructions: a PUT to our route (fake provider) or a tus upload
 * straight to the vendor (Bunny), so large files never pass through Vercel.
 */
export function MediaUploader({ postId, postTitle }: { postId: string; postTitle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function uploadImage(file: File) {
    const form = new FormData();
    form.set("postId", postId);
    form.set("file", file);
    const res = await fetch("/api/admin/media/image", {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    if (!res.ok)
      throw new Error(
        `Image upload failed (${(await res.json().catch(() => ({}))).error ?? res.status})`,
      );
  }

  async function uploadVideo(file: File) {
    const started = await startVideoUploadAction(postId, postTitle);
    if ("error" in started) throw new Error(started.error);
    const { mediaId, upload } = started;
    if (upload.method === "put") {
      const res = await fetch(upload.url, {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type || "video/mp4", ...(upload.headers ?? {}) },
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`Video upload failed (${res.status})`);
    } else {
      await new Promise<void>((resolve, reject) => {
        const u = new tus.Upload(file, {
          endpoint: upload.endpoint,
          headers: upload.headers,
          metadata: { ...upload.metadata, filetype: file.type, filename: file.name },
          retryDelays: [0, 3000, 5000, 10000, 20000],
          chunkSize: 50 * 1024 * 1024,
          onError: reject,
          onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
          onSuccess: () => resolve(),
        });
        u.start();
      });
    }
    await syncVideoAction(mediaId);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setError(null);
    for (const file of files) {
      setBusy(file.name);
      setProgress(null);
      try {
        if (file.type.startsWith("image/")) await uploadImage(file);
        else if (file.type.startsWith("video/")) await uploadVideo(file);
        else throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        break;
      }
    }
    setBusy(null);
    setProgress(null);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-dashed border-zinc-700 p-4">
      {error && <Alert kind="error">{error}</Alert>}
      <label className="block cursor-pointer text-sm">
        <span className="rounded-md bg-zinc-100 px-3 py-2 font-medium text-zinc-900">
          {busy ? `Uploading ${busy}…` : "Add photos or videos"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,video/*"
          multiple
          className="hidden"
          disabled={!!busy}
          onChange={onPick}
        />
      </label>
      {progress != null && <p className="mt-2 text-xs text-zinc-400">{progress}%</p>}
      <p className="mt-2 text-xs text-zinc-500">
        Photos are re-encoded with camera metadata removed. Videos are processed by the provider;
        refresh to see status.
      </p>
    </div>
  );
}
