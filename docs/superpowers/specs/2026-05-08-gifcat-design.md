# Gifcat product design

## Product direction

Gifcat is a lightweight cross-platform desktop GIF editor for Windows, macOS, and Ubuntu. It focuses on one base GIF and lets the user add timed overlays such as text, images, GIFs, and watermark presets, with an editing experience that is closer to a small offline OBS compositor than a full video editor.

The target use cases are:

- Product and technical demos where a recorded GIF needs annotations, labels, callouts, or branding.
- Lightweight general GIF editing where opening a heavy video editor would be overkill.

## MVP scope

In scope for the first version:

- Import one base GIF.
- The base GIF determines canvas size and total timeline duration.
- Real-time per-frame preview on a canvas.
- Add and edit overlays:
  - Text with font, stroke, shadow, alignment, transform, opacity, and timing.
  - Image overlays with transform, opacity, and timing.
  - GIF overlays with transform, opacity, and timing.
  - Watermark as a preset built on image/text overlays.
- Uniform scale only.
- Center anchor only.
- Timing clamped to `[0, duration]`.
- Fade in/out for overlays.
- In-place text editing on canvas.
- Single overlay selection in v1.
- Export GIF.
- Fast export mode using ffmpeg only.
- High-quality export mode using ffmpeg composition to PNG frames followed by gifski encoding.

Out of scope for MVP:

- Project files.
- Multi-base-GIF concatenation.
- Video input/output.
- Keyframes beyond simple fade in/out.
- Filters, masks, and blend modes.
- Multi-select.
- Non-uniform scaling.
- Web font management.

## Design constraints

- UI should be canvas-first with floating panels and lightweight timeline controls.
- Do not use emoji as icons. Use an SVG icon library such as lucide-react or custom SVGs.
- The app should feel focused and fast, not like a full NLE.
- Preview and export must share the same project model so later golden-frame tests can compare them.

## Technology stack

- Desktop shell: Tauri 2.
- Frontend: React, TypeScript, Vite.
- State: Zustand.
- Icons: lucide-react.
- Backend: Rust Tauri commands.
- Preview decode for M1: Rust `gif` crate.
- Export sidecars:
  - ffmpeg for composition and fast GIF export.
  - gifski for optional high-quality encoding.

## Core data model

```ts
type Project = {
  base: BaseGif;
  overlays: Overlay[];
  canvas: { width: number; height: number };
};

type BaseGif = {
  sourcePath: string;
  durationMs: number;
  frameCount: number;
  nativeFps: number;
};

type Overlay = TextOverlay | ImageOverlay | GifOverlay;

type OverlayBase = {
  id: string;
  name: string;
  transform: Transform;
  opacity: number;
  timing: Timing;
  visible: boolean;
  locked: boolean;
};

type Transform = {
  x: number;
  y: number;
  scale: number;
  rotationDeg: number;
  anchor: 'center';
};

type Timing = {
  startMs: number;
  endMs: number;
  fadeInMs: number;
  fadeOutMs: number;
};
```

## Store shape

```ts
type ProjectStore = {
  project: Project;
  selectedOverlayId: string | null;
  timelineCursorMs: number;
  zoomPct: number;
  playing: boolean;

  apply(command: Command): void;
  undo(): void;
  redo(): void;
};
```

## Architecture

Frontend responsibilities:

- Render app shell, toolbar, canvas, timeline, and future floating inspector panels.
- Own interactive preview playback state.
- Convert decoded RGBA frames to `ImageBitmap` for canvas rendering.
- Keep UI operations type-safe and testable.

Rust responsibilities:

- File-system and native dialog integration.
- Decode GIFs into fully composed RGBA frames for M1 preview.
- Later, orchestrate ffmpeg and gifski sidecars for export.
- Later, scan fonts and provide font metadata/files for preview/export consistency.

## GIF preview pipeline

For M1:

1. User opens a GIF file.
2. Frontend passes the selected path to a Tauri command.
3. Rust decodes the GIF into:
   - width
   - height
   - delays in milliseconds
   - fully composed RGBA frames
4. Frontend converts RGBA frames into `ImageBitmap` objects.
5. Canvas renders the current frame based on timeline cursor and GIF delays.

Rust decoder must account for GIF disposal modes: `Background`, `Previous`, `Keep`, and `Any`.

## Export pipeline

Fast mode:

1. Build an ffmpeg filter graph from the project model.
2. Composite overlays using ffmpeg.
3. Use ffmpeg palette generation and palette use for GIF output.

High-quality mode:

1. Use ffmpeg to composite the project into PNG frames.
2. Use gifski to encode the PNG sequence into the final GIF.

Open licensing question:

- gifski is AGPL. Before shipping, choose one of:
  - license the whole project compatibly,
  - require user-provided gifski,
  - dynamically download/manage gifski in a way that satisfies licensing constraints.

## Milestones

### M1: App skeleton and base GIF loading

- Scaffold Tauri + React + TypeScript app.
- Open a GIF file.
- Decode GIF in Rust.
- Display decoded frames on canvas.
- Play/pause and scrub a simple timeline.

### M2: Overlay model and image overlay editing

- Add project/overlay store.
- Add image overlay import.
- Select and transform one overlay.
- Clamp timing to base GIF duration.

### M3: Text, GIF overlays, watermark preset, fades

- Add text overlay with in-place canvas editing.
- Add GIF overlay support.
- Add watermark preset.
- Add fade in/out handling in preview.

### M4: Fast ffmpeg export

- Build ffmpeg sidecar integration.
- Export GIF via ffmpeg.
- Surface export progress and errors.

### M5: High-quality export and consistency tests

- Add gifski high-quality mode.
- Add golden-frame consistency tests between preview and export.

### M6: Packaging and cross-platform validation

- Package for macOS, Windows, and Ubuntu.
- Validate sidecar bundling or installation strategy.
- Validate file dialogs, paths, and export behavior across platforms.
