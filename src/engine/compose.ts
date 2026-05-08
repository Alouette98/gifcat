import { pickFrameIndex } from "./framePicker";
import type {
  Overlay,
  ImageOverlay,
  GifOverlay,
  TextOverlay,
} from "../types/overlay";

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function getOverlayOpacity(overlay: Overlay, cursorMs: number): number {
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

export function getOverlayBounds(overlay: Overlay) {
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

export function drawOverlay(
  ctx: Ctx2D,
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

export function drawFrame(
  ctx: Ctx2D,
  baseFrame: ImageBitmap | null,
  overlays: Overlay[],
  cursorMs: number,
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
  if (baseFrame) {
    ctx.drawImage(baseFrame, 0, 0);
  }
  for (const overlay of overlays) {
    drawOverlay(ctx, overlay, cursorMs);
  }
}
