import { invoke } from "@tauri-apps/api/core";

export interface ExportOptions {
  outputPath: string;
  framesDir: string;
  fps: number;
  quality?: "standard" | "high";
}

export async function createExportTempdir(): Promise<string> {
  return invoke<string>("export_create_tempdir");
}

export async function writeExportFrame(
  dir: string,
  index: number,
  png: Uint8Array,
): Promise<void> {
  return invoke<void>("export_write_frame", {
    request: { dir, index, png: Array.from(png) },
  });
}

export async function exportGif(options: ExportOptions): Promise<string> {
  return invoke<string>("export_gif", {
    request: {
      outputPath: options.outputPath,
      framesDir: options.framesDir,
      fps: options.fps,
      quality: options.quality ?? "standard",
    },
  });
}
