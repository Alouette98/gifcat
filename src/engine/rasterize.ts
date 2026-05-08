import { drawFrame } from "./compose";
import { pickFrameIndex } from "./framePicker";
import type { Overlay } from "../types/overlay";

export interface RasterizeOptions {
  width: number;
  height: number;
  baseFrames: ImageBitmap[];
  baseDelaysMs: number[];
  totalDurationMs: number;
  fps: number;
  overlays: Overlay[];
  onProgress?: (done: number, total: number) => void;
}

export interface RasterizedFrame {
  index: number;
  png: Uint8Array;
}

export async function rasterizeFrames(
  opts: RasterizeOptions,
): Promise<RasterizedFrame[]> {
  const { width, height, baseFrames, baseDelaysMs, totalDurationMs, fps, overlays, onProgress } = opts;

  const frameCount = Math.max(1, Math.round((totalDurationMs / 1000) * fps));
  const frameStepMs = 1000 / fps;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create 2D context");

  const out: RasterizedFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const cursorMs = i * frameStepMs;
    const baseIdx = pickFrameIndex(baseDelaysMs, cursorMs);
    const baseFrame = baseFrames[baseIdx] ?? null;

    drawFrame(ctx, baseFrame, overlays, cursorMs, width, height);

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const buf = await blob.arrayBuffer();
    out.push({ index: i, png: new Uint8Array(buf) });

    onProgress?.(i + 1, frameCount);
  }

  return out;
}
