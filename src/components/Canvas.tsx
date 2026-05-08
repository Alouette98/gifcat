import { useRef, useEffect, useCallback, type MouseEvent } from "react";
import { usePlaybackStore } from "../store/playbackStore";
import { useProjectStore } from "../store/projectStore";
import { pickFrameIndex } from "../engine/framePicker";
import type { Overlay, ImageOverlay, GifOverlay, TextOverlay } from "../types/overlay";
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

function getOverlayBounds(overlay: Overlay) {
  const { x, y, scale } = overlay.transform;
  let w = 0;
  let h = 0;
  if (overlay.type === "image") {
    w = (overlay as ImageOverlay).naturalWidth * scale;
    h = (overlay as ImageOverlay).naturalHeight * scale;
  } else if (overlay.type === "gif") {
    w = (overlay as GifOverlay).naturalWidth * scale;
    h = (overlay as GifOverlay).naturalHeight * scale;
  } else if (overlay.type === "text") {
    const txt = overlay as TextOverlay;
    const fontSize = txt.fontSize * scale;
    w = fontSize * Math.max(txt.text.length * 0.6, 1);
    h = fontSize * 1.3;
  }
  return { x: x - w / 2, y: y - h / 2, w, h };
}

function hitTest(overlay: Overlay, px: number, py: number): boolean {
  const { x, y, w, h } = getOverlayBounds(overlay);
  return px >= x && px <= x + w && py >= y && py <= y + h;
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
  } else if (overlay.type === "gif") {
    const gif = overlay as GifOverlay;
    if (gif.frames.length > 0) {
      const gifDuration = gif.delaysMs.reduce((a, b) => a + b, 0);
      const gifCursor = gifDuration > 0 ? cursorMs % gifDuration : 0;
      const idx = pickFrameIndex(gif.delaysMs, gifCursor);
      const frame = gif.frames[idx];
      if (frame) {
        const w = gif.naturalWidth * scale;
        const h = gif.naturalHeight * scale;
        ctx.drawImage(frame, -w / 2, -h / 2, w, h);
      }
    }
  } else if (overlay.type === "text") {
    const txt = overlay as TextOverlay;
    const fontSize = txt.fontSize * scale;
    ctx.font = `${fontSize}px ${txt.fontFamily}`;
    ctx.textAlign = txt.align;
    ctx.textBaseline = "middle";

    if (txt.shadowBlur > 0) {
      ctx.shadowColor = txt.shadowColor;
      ctx.shadowBlur = txt.shadowBlur * scale;
    }

    if (txt.strokeWidth > 0) {
      ctx.strokeStyle = txt.strokeColor;
      ctx.lineWidth = txt.strokeWidth * scale;
      ctx.strokeText(txt.text, 0, 0);
    }

    ctx.fillStyle = txt.color;
    ctx.fillText(txt.text, 0, 0);
  }

  ctx.restore();
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, overlay: Overlay) {
  const { x, y, w, h } = getOverlayBounds(overlay);
  ctx.save();
  ctx.strokeStyle = "#89b4fa";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  const handleSize = 8;
  ctx.fillStyle = "#89b4fa";
  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
  }
  ctx.restore();
}

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const { frames, delaysMs, width, height, playing, cursorMs, setCursorMs } =
    usePlaybackStore();

  const overlays = useProjectStore((s) => s.project.overlays);
  const selectedId = useProjectStore((s) => s.selectedOverlayId);
  const selectOverlay = useProjectStore((s) => s.selectOverlay);
  const apply = useProjectStore((s) => s.apply);

  const toCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { cx: 0, cy: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      return {
        cx: (clientX - rect.left) * scaleX,
        cy: (clientY - rect.top) * scaleY,
      };
    },
    [width, height],
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      const { cx, cy } = toCanvasCoords(e.clientX, e.clientY);
      const curMs = usePlaybackStore.getState().cursorMs;

      for (let i = overlays.length - 1; i >= 0; i--) {
        const ov = overlays[i];
        if (!ov.visible || ov.locked) continue;
        const alpha = getOverlayOpacity(ov, curMs);
        if (alpha <= 0) continue;
        if (hitTest(ov, cx, cy)) {
          selectOverlay(ov.id);
          dragRef.current = {
            id: ov.id,
            startX: cx,
            startY: cy,
            origX: ov.transform.x,
            origY: ov.transform.y,
          };
          return;
        }
      }
      selectOverlay(null);
    },
    [overlays, toCanvasCoords, selectOverlay],
  );

  useEffect(() => {
    function handleMouseMove(e: globalThis.MouseEvent) {
      if (!dragRef.current) return;
      const { cx, cy } = toCanvasCoords(e.clientX, e.clientY);
      const dx = cx - dragRef.current.startX;
      const dy = cy - dragRef.current.startY;
      const ov = useProjectStore.getState().project.overlays.find(
        (o) => o.id === dragRef.current!.id,
      );
      if (!ov) return;
      apply({
        type: "updateOverlay",
        id: ov.id,
        patch: {
          transform: {
            ...ov.transform,
            x: dragRef.current.origX + dx,
            y: dragRef.current.origY + dy,
          },
        },
      });
    }

    function handleMouseUp() {
      dragRef.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [toCanvasCoords, apply]);

  useEffect(() => {
    function handleWheel(e: WheelEvent) {
      if (!selectedId) return;
      e.preventDefault();
      const ov = useProjectStore.getState().project.overlays.find(
        (o) => o.id === selectedId,
      );
      if (!ov) return;
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      const newScale = Math.max(0.05, Math.min(10, ov.transform.scale * delta));
      apply({
        type: "updateOverlay",
        id: ov.id,
        patch: { transform: { ...ov.transform, scale: newScale } },
      });
    }

    const wrap = wrapRef.current;
    if (wrap) {
      wrap.addEventListener("wheel", handleWheel, { passive: false });
      return () => wrap.removeEventListener("wheel", handleWheel);
    }
  }, [selectedId, apply]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frames.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      const playback = usePlaybackStore.getState();
      const { project, selectedOverlayId } = useProjectStore.getState();
      const idx = pickFrameIndex(playback.delaysMs, playback.cursorMs);
      const frame = playback.frames[idx];
      if (frame && ctx) {
        ctx.clearRect(0, 0, playback.width, playback.height);
        ctx.drawImage(frame, 0, 0);

        for (const overlay of project.overlays) {
          drawOverlay(ctx, overlay, playback.cursorMs);
        }

        if (selectedOverlayId) {
          const sel = project.overlays.find((o) => o.id === selectedOverlayId);
          if (sel) drawSelectionBox(ctx, sel);
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
  }, [frames, delaysMs, width, height, playing, cursorMs, setCursorMs, overlays, selectedId]);

  if (frames.length === 0) {
    return (
      <div className={styles.canvasWrap} ref={wrapRef}>
        <span className={styles.empty}>Open a GIF to begin</span>
      </div>
    );
  }

  return (
    <div className={styles.canvasWrap} ref={wrapRef}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
