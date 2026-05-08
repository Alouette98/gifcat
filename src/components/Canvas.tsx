import { useRef, useEffect } from "react";
import { usePlaybackStore } from "../store/playbackStore";
import { useProjectStore } from "../store/projectStore";
import { pickFrameIndex } from "../engine/framePicker";
import type { Overlay, ImageOverlay } from "../types/overlay";
import styles from "./Canvas.module.css";

function getOverlayOpacity(overlay: Overlay, cursorMs: number): number {
  const { timing, opacity } = overlay;
  if (cursorMs < timing.startMs || cursorMs > timing.endMs) return 0;

  let fade = 1;
  const elapsed = cursorMs - timing.startMs;
  const remaining = timing.endMs - cursorMs;

  if (timing.fadeInMs > 0 && elapsed < timing.fadeInMs) {
    fade = elapsed / timing.fadeInMs;
  }
  if (timing.fadeOutMs > 0 && remaining < timing.fadeOutMs) {
    fade = Math.min(fade, remaining / timing.fadeOutMs);
  }

  return opacity * fade;
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: Overlay,
  cursorMs: number,
) {
  if (!overlay.visible) return;
  const alpha = getOverlayOpacity(overlay, cursorMs);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const { x, y, scale, rotationDeg } = overlay.transform;
  ctx.translate(x, y);
  if (rotationDeg !== 0) {
    ctx.rotate((rotationDeg * Math.PI) / 180);
  }

  if (overlay.type === "image") {
    const img = overlay as ImageOverlay;
    if (img.bitmap) {
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img.bitmap, -w / 2, -h / 2, w, h);
    }
  }

  ctx.restore();
}

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const { frames, delaysMs, width, height, playing, cursorMs, setCursorMs } =
    usePlaybackStore();

  const overlays = useProjectStore((s) => s.project.overlays);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frames.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      const playback = usePlaybackStore.getState();
      const project = useProjectStore.getState().project;
      const idx = pickFrameIndex(playback.delaysMs, playback.cursorMs);
      const frame = playback.frames[idx];
      if (frame && ctx) {
        ctx.clearRect(0, 0, playback.width, playback.height);
        ctx.drawImage(frame, 0, 0);

        for (const overlay of project.overlays) {
          drawOverlay(ctx, overlay, playback.cursorMs);
        }
      }
    }

    function loop(timestamp: number) {
      const state = usePlaybackStore.getState();
      if (state.playing) {
        if (lastTimeRef.current === 0) {
          lastTimeRef.current = timestamp;
        }
        const delta = timestamp - lastTimeRef.current;
        lastTimeRef.current = timestamp;
        setCursorMs(state.cursorMs + delta);
      } else {
        lastTimeRef.current = 0;
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [frames, delaysMs, width, height, playing, cursorMs, setCursorMs, overlays]);

  if (frames.length === 0) {
    return (
      <div className={styles.canvasWrap}>
        <span className={styles.empty}>Open a GIF to begin</span>
      </div>
    );
  }

  return (
    <div className={styles.canvasWrap}>
      <canvas ref={canvasRef} width={width} height={height} />
    </div>
  );
}
