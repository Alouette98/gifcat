export type Transform = {
  x: number;
  y: number;
  scale: number;
  rotationDeg: number;
  anchor: "center";
};

export type Timing = {
  startMs: number;
  endMs: number;
  fadeInMs: number;
  fadeOutMs: number;
};

export type OverlayBase = {
  id: string;
  name: string;
  transform: Transform;
  opacity: number;
  timing: Timing;
  visible: boolean;
  locked: boolean;
};

export type TextOverlay = OverlayBase & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  align: "left" | "center" | "right";
};

export type ImageOverlay = OverlayBase & {
  type: "image";
  sourcePath: string;
  bitmap: ImageBitmap | null;
  naturalWidth: number;
  naturalHeight: number;
};

export type GifOverlay = OverlayBase & {
  type: "gif";
  sourcePath: string;
  frames: ImageBitmap[];
  delaysMs: number[];
  naturalWidth: number;
  naturalHeight: number;
};

export type Overlay = TextOverlay | ImageOverlay | GifOverlay;

export type BaseGif = {
  sourcePath: string;
  durationMs: number;
  frameCount: number;
  width: number;
  height: number;
};

export type Project = {
  base: BaseGif | null;
  overlays: Overlay[];
  canvas: { width: number; height: number };
};

export function createTransform(
  x = 0,
  y = 0,
  scale = 1,
  rotationDeg = 0,
): Transform {
  return { x, y, scale, rotationDeg, anchor: "center" };
}

export function createTiming(
  durationMs: number,
  startMs = 0,
): Timing {
  return {
    startMs,
    endMs: durationMs,
    fadeInMs: 0,
    fadeOutMs: 0,
  };
}

let nextId = 1;
export function generateId(): string {
  return `overlay-${nextId++}-${Date.now()}`;
}
