import { useRef, useEffect, useCallback, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { usePlaybackStore } from "../store/playbackStore";
import { useProjectStore } from "../store/projectStore";
import { pickFrameIndex } from "../engine/framePicker";
import {
  drawFrame,
  getOverlayBounds,
  getOverlayOpacity,
} from "../engine/compose";
import type { Overlay } from "../types/overlay";
import styles from "./Canvas.module.css";

function hitTest(overlay: Overlay, px: number, py: number): boolean {
  const { x, y, w, h } = getOverlayBounds(overlay);
  return px >= x && px <= x + w && py >= y && py <= y + h;
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
  const { t } = useTranslation();
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
          useProjectStore.getState().beginTransient();
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
    let raf = 0;
    let pending: { x: number; y: number } | null = null;

    function flush() {
      raf = 0;
      if (!pending || !dragRef.current) return;
      const store = useProjectStore.getState();
      const ov = store.project.overlays.find((o) => o.id === dragRef.current!.id);
      if (!ov) return;
      store.applyTransient({
        type: "updateOverlay",
        id: ov.id,
        patch: { transform: { ...ov.transform, x: pending.x, y: pending.y } },
      });
      pending = null;
    }

    function handleMouseMove(e: globalThis.MouseEvent) {
      if (!dragRef.current) return;
      const { cx, cy } = toCanvasCoords(e.clientX, e.clientY);
      const dx = cx - dragRef.current.startX;
      const dy = cy - dragRef.current.startY;
      pending = {
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      };
      if (raf === 0) raf = requestAnimationFrame(flush);
    }

    function handleMouseUp() {
      if (!dragRef.current) return;
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        flush();
      }
      useProjectStore.getState().commitTransient();
      dragRef.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [toCanvasCoords]);

  useEffect(() => {
    let commitTimer: number | null = null;
    let started = false;

    function handleWheel(e: WheelEvent) {
      if (!selectedId) return;
      e.preventDefault();
      const store = useProjectStore.getState();
      const ov = store.project.overlays.find((o) => o.id === selectedId);
      if (!ov) return;
      if (!started) {
        store.beginTransient();
        started = true;
      }
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      const newScale = Math.max(0.05, Math.min(10, ov.transform.scale * delta));
      store.applyTransient({
        type: "updateOverlay",
        id: ov.id,
        patch: { transform: { ...ov.transform, scale: newScale } },
      });
      if (commitTimer !== null) window.clearTimeout(commitTimer);
      commitTimer = window.setTimeout(() => {
        useProjectStore.getState().commitTransient();
        started = false;
        commitTimer = null;
      }, 180);
    }

    const wrap = wrapRef.current;
    if (wrap) {
      wrap.addEventListener("wheel", handleWheel, { passive: false });
      return () => {
        wrap.removeEventListener("wheel", handleWheel);
        if (commitTimer !== null) window.clearTimeout(commitTimer);
      };
    }
  }, [selectedId]);

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
      if (ctx) {
        drawFrame(
          ctx,
          frame ?? null,
          project.overlays,
          playback.cursorMs,
          playback.width,
          playback.height,
        );

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
        <span className={styles.empty}>{t("canvas.empty")}</span>
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
