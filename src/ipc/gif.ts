import { invoke } from "@tauri-apps/api/core";

export type DecodedGif = {
  width: number;
  height: number;
  delaysMs: number[];
  framesRgba: Uint8ClampedArray[];
};

export async function decodeGif(path: string): Promise<DecodedGif> {
  const resp = await invoke<ArrayBuffer>("decode_gif", { path });
  const dv = new DataView(resp);
  const width = dv.getUint32(0, true);
  const height = dv.getUint32(4, true);
  const n = dv.getUint32(8, true);

  const delaysMs: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    delaysMs[i] = dv.getUint32(12 + i * 4, true);
  }

  const stride = width * height * 4;
  const rgbaStart = 12 + n * 4;
  const framesRgba: Uint8ClampedArray[] = new Array(n);
  for (let i = 0; i < n; i++) {
    framesRgba[i] = new Uint8ClampedArray(resp, rgbaStart + i * stride, stride);
  }

  return { width, height, delaysMs, framesRgba };
}

export async function framesToBitmaps(
  decoded: DecodedGif,
  onProgress?: (done: number, total: number) => void,
): Promise<ImageBitmap[]> {
  const { width, height, framesRgba } = decoded;
  const bitmaps: ImageBitmap[] = new Array(framesRgba.length);
  for (let i = 0; i < framesRgba.length; i++) {
    const imageData = new ImageData(framesRgba[i], width, height);
    bitmaps[i] = await createImageBitmap(imageData);
    if (onProgress) onProgress(i + 1, framesRgba.length);
    if ((i & 7) === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return bitmaps;
}
