import { invoke } from "@tauri-apps/api/core";
import type { Overlay } from "../types/overlay";

type OverlayDto =
  | { type: "text"; text: string; x: number; y: number; scale: number; fontSize: number; fontFamily: string; color: string; strokeColor: string; strokeWidth: number; opacity: number; startMs: number; endMs: number; fadeInMs: number; fadeOutMs: number }
  | { type: "image"; path: string; x: number; y: number; scale: number; opacity: number; naturalWidth: number; naturalHeight: number; startMs: number; endMs: number; fadeInMs: number; fadeOutMs: number }
  | { type: "gif"; path: string; x: number; y: number; scale: number; opacity: number; naturalWidth: number; naturalHeight: number; startMs: number; endMs: number; fadeInMs: number; fadeOutMs: number };

function overlayToDto(o: Overlay): OverlayDto {
  const { x, y, scale } = o.transform;
  const base = { x, y, scale, opacity: o.opacity, startMs: o.timing.startMs, endMs: o.timing.endMs, fadeInMs: o.timing.fadeInMs, fadeOutMs: o.timing.fadeOutMs };

  switch (o.type) {
    case "text":
      return { type: "text", text: o.text, fontSize: o.fontSize, fontFamily: o.fontFamily, color: o.color, strokeColor: o.strokeColor, strokeWidth: o.strokeWidth, ...base };
    case "image":
      return { type: "image", path: o.sourcePath, naturalWidth: o.naturalWidth, naturalHeight: o.naturalHeight, ...base };
    case "gif":
      return { type: "gif", path: o.sourcePath, naturalWidth: o.naturalWidth, naturalHeight: o.naturalHeight, ...base };
  }
}

export interface ExportOptions {
  basePath: string;
  outputPath: string;
  width: number;
  height: number;
  overlays: Overlay[];
}

export async function exportGif(options: ExportOptions): Promise<string> {
  const request = {
    basePath: options.basePath,
    outputPath: options.outputPath,
    width: options.width,
    height: options.height,
    overlays: options.overlays
      .filter((o) => o.visible)
      .map(overlayToDto),
  };
  return invoke<string>("export_gif", { request });
}
