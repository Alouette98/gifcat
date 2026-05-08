import { invoke } from "@tauri-apps/api/core";

export type DecodedGif = {
  width: number;
  height: number;
  delaysMs: number[];
  framesRgba: number[][];
};

export async function decodeGif(path: string): Promise<DecodedGif> {
  return await invoke<DecodedGif>("decode_gif", { path });
}

export async function framesToBitmaps(
  decoded: DecodedGif,
): Promise<ImageBitmap[]> {
  const { width, height, framesRgba } = decoded;
  const bitmaps: ImageBitmap[] = [];
  for (const frame of framesRgba) {
    const bytes = new Uint8ClampedArray(frame);
    const imageData = new ImageData(bytes, width, height);
    const bitmap = await createImageBitmap(imageData);
    bitmaps.push(bitmap);
  }
  return bitmaps;
}
