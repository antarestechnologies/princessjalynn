"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewItem, Watermark } from "@/content/playback";

/**
 * Renders unlocked media with:
 *  - a visible per-viewer watermark (handle + grant nonce + clock) that moves every few seconds;
 *  - token refresh before expiry via POST /api/media/[id]/playback;
 *  - deterrents: no context menu, no download control, no picture-in-picture, blur when the
 *    tab is hidden or the window loses focus.
 * These deterrents raise the effort for casual saving. They do NOT stop screen recording or a
 * phone camera; the watermark exists so a leak can be traced to a grant. See README.
 */
export function MediaViewer({ initial, watermark }: { initial: ViewItem[]; watermark: Watermark }) {
  const [items, setItems] = useState(initial);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState !== "visible");
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const refresh = useCallback(async (mediaId: string) => {
    const res = await fetch(`/api/media/${mediaId}/playback`, {
      method: "POST",
      credentials: "same-origin",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { items: ViewItem[] };
    const fresh = data.items[0];
    if (fresh) setItems((prev) => prev.map((i) => (i.mediaId === mediaId ? fresh : i)));
  }, []);

  useEffect(() => {
    const timers = items.map((i) => {
      const ms = new Date(i.expiresAt).getTime() - Date.now() - 60_000;
      return setTimeout(() => void refresh(i.mediaId), Math.max(5_000, ms));
    });
    return () => timers.forEach(clearTimeout);
  }, [items, refresh]);

  const block = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div
      className={`space-y-6 transition ${hidden ? "blur-xl" : ""}`}
      onContextMenu={block}
      onDragStart={block}
    >
      {items.map((item) => (
        <figure key={item.mediaId} className="relative overflow-hidden rounded-lg bg-black">
          {item.source?.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element -- signed, expiring URL; not optimizable
            <img
              src={item.source.url}
              alt=""
              draggable={false}
              className="mx-auto max-h-[80vh] w-auto select-none"
            />
          )}
          {item.source?.kind === "video" && (
            <video
              src={item.source.url}
              poster={item.posterUrl ?? undefined}
              controls
              controlsList="nodownload noremoteplayback noplaybackrate"
              disablePictureInPicture
              disableRemotePlayback
              playsInline
              preload="metadata"
              className="mx-auto max-h-[80vh] w-full"
              onContextMenu={block}
            />
          )}
          {item.source?.kind === "iframe" && (
            <div className="relative" style={{ paddingTop: "56.25%" }}>
              <iframe
                src={item.source.url}
                className="absolute inset-0 h-full w-full"
                allow="encrypted-media; fullscreen"
                allowFullScreen
                referrerPolicy="same-origin"
                title="video"
              />
            </div>
          )}
          <WatermarkOverlay watermark={watermark} />
        </figure>
      ))}
    </div>
  );
}

const POSITIONS = [
  "left-3 top-3",
  "right-3 top-3",
  "left-3 bottom-10",
  "right-3 bottom-10",
  "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
  "left-1/2 top-6 -translate-x-1/2",
  "left-1/2 bottom-12 -translate-x-1/2",
];

function WatermarkOverlay({ watermark }: { watermark: Watermark }) {
  const [pos, setPos] = useState(0);
  const [clock, setClock] = useState("");
  const tick = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const update = () => setClock(new Date().toISOString().slice(0, 16).replace("T", " ") + "Z");
    update();
    tick.current = setInterval(update, 30_000);
    const mover = setInterval(() => setPos(Math.floor(Math.random() * POSITIONS.length)), 7_000);
    return () => {
      clearInterval(tick.current);
      clearInterval(mover);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute select-none rounded px-2 py-1 font-mono text-[11px] leading-tight text-white/70 mix-blend-difference ${POSITIONS[pos]}`}
    >
      @{watermark.handle} · {watermark.nonce} · {clock}
    </div>
  );
}
