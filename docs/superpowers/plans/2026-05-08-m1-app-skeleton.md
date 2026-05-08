# M1 implementation plan: app skeleton and base GIF loading

## Goal

Bootstrap Gifcat as a Tauri 2 + React + TypeScript desktop app that can open one base GIF, decode it in Rust, render decoded frames on a canvas, and provide play/pause plus basic timeline scrubbing.

## Constraints

- Use pnpm.
- Use React + TypeScript + Vite.
- Use Tauri 2.
- Use lucide-react for icons. Do not use emoji icons.
- Keep implementation focused on M1 only; do not build overlay editing yet.
- Prefer pure, testable logic for frame selection.
- Keep the decode path simple for M1 even if JSON frame transfer is not the final optimized transport.

## Planned file structure

```text
gifcat/
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.module.css
│   ├── ipc/gif.ts
│   ├── engine/framePicker.ts
│   ├── engine/framePicker.test.ts
│   ├── store/playbackStore.ts
│   ├── components/Toolbar.tsx
│   ├── components/Toolbar.module.css
│   ├── components/Canvas.tsx
│   ├── components/Canvas.module.css
│   ├── components/Timeline.tsx
│   ├── components/Timeline.module.css
│   └── styles/global.css
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── src/main.rs
│   ├── src/lib.rs
│   ├── src/commands/decode_gif.rs
│   └── src/gif/decoder.rs
└── docs/superpowers/...
```

## Task 1: Scaffold Tauri + React + TypeScript

Status: in progress.

Implementation steps:

1. Create a Tauri 2 React TypeScript scaffold in `/Users/dengchg/aj/gifcat`.
2. Install dependencies with pnpm.
3. Add runtime dependencies:
   - `zustand`
   - `lucide-react`
   - Tauri dialog plugin when needed by the toolbar task.
4. Add test dependencies:
   - `vitest`
   - `@vitest/ui`
   - `jsdom`
   - `@testing-library/react`
   - `@testing-library/jest-dom`
5. Configure Vitest in `vite.config.ts`.
6. Add `vitest.setup.ts`.
7. Add scripts:
   - `test`: `vitest run`
   - `test:watch`: `vitest`
8. Add Rust GIF dependency in `src-tauri/Cargo.toml`:
   - `gif = "0.13"`
9. Verify the scaffold builds or starts.
10. Initialize git if needed and commit the scaffold.

Acceptance criteria:

- App scaffold exists.
- `pnpm install` succeeds.
- `pnpm test` can run with no tests or with passing tests.
- Rust dependency graph resolves.
- Documentation from planning remains in `docs/superpowers`.

## Task 2: framePicker TDD

Create `src/engine/framePicker.ts` and `src/engine/framePicker.test.ts`.

Implementation target:

```ts
export function pickFrameIndex(delaysMs: number[], cursorMs: number): number {
  if (delaysMs.length === 0) return 0;
  if (cursorMs < 0) return 0;

  const total = delaysMs.reduce((sum, d) => sum + d, 0);
  if (total <= 0) return 0;

  const wrapped = cursorMs % total;
  let acc = 0;
  for (let i = 0; i < delaysMs.length; i++) {
    acc += delaysMs[i];
    if (wrapped < acc) return i;
  }
  return delaysMs.length - 1;
}
```

Test cases:

- Empty delays returns 0.
- Negative cursor returns 0.
- Single frame returns 0.
- Cursor selects correct frame across variable delays.
- Cursor wraps at total duration.
- Zero or invalid total returns 0.

Acceptance criteria:

- Tests are written before or alongside implementation.
- `pnpm test` passes.
- Function has no React or browser dependencies.

## Task 3: Rust GIF decoder

Create `src-tauri/src/gif/decoder.rs` and wire module exports.

Implementation target:

```rust
use gif::{DecodeOptions, DisposalMethod};
use std::fs::File;
use std::path::Path;

pub struct DecodedGif {
    pub width: u32,
    pub height: u32,
    pub delays_ms: Vec<u32>,
    pub frames_rgba: Vec<Vec<u8>>,
}

#[derive(Debug)]
pub enum DecodeError {
    Io(std::io::Error),
    Gif(gif::DecodingError),
}

pub fn decode_path(path: &Path) -> Result<DecodedGif, DecodeError> {
    let file = File::open(path).map_err(DecodeError::Io)?;
    let mut options = DecodeOptions::new();
    options.set_color_output(gif::ColorOutput::RGBA);
    let mut decoder = options.read_info(file).map_err(DecodeError::Gif)?;

    let width = decoder.width() as u32;
    let height = decoder.height() as u32;
    let pixel_count = (width as usize) * (height as usize);
    let byte_count = pixel_count * 4;

    let mut canvas = vec![0u8; byte_count];
    let mut previous: Option<Vec<u8>> = None;
    let mut delays_ms: Vec<u32> = Vec::new();
    let mut frames_rgba: Vec<Vec<u8>> = Vec::new();

    while let Some(frame) = decoder.read_next_frame().map_err(DecodeError::Gif)? {
        let delay_ms = (frame.delay as u32) * 10;
        let delay_ms = if delay_ms == 0 { 100 } else { delay_ms };

        let fx = frame.left as u32;
        let fy = frame.top as u32;
        let fw = frame.width as u32;
        let fh = frame.height as u32;

        if matches!(frame.dispose, DisposalMethod::Previous) {
            previous = Some(canvas.clone());
        }

        for row in 0..fh {
            for col in 0..fw {
                let src_idx = ((row * fw + col) * 4) as usize;
                let dst_x = fx + col;
                let dst_y = fy + row;
                if dst_x >= width || dst_y >= height {
                    continue;
                }
                let dst_idx = ((dst_y * width + dst_x) * 4) as usize;
                let a = frame.buffer[src_idx + 3];
                if a == 0 {
                    continue;
                }
                canvas[dst_idx] = frame.buffer[src_idx];
                canvas[dst_idx + 1] = frame.buffer[src_idx + 1];
                canvas[dst_idx + 2] = frame.buffer[src_idx + 2];
                canvas[dst_idx + 3] = 255;
            }
        }

        frames_rgba.push(canvas.clone());
        delays_ms.push(delay_ms);

        match frame.dispose {
            DisposalMethod::Background => {
                for row in 0..fh {
                    for col in 0..fw {
                        let dst_x = fx + col;
                        let dst_y = fy + row;
                        if dst_x >= width || dst_y >= height {
                            continue;
                        }
                        let dst_idx = ((dst_y * width + dst_x) * 4) as usize;
                        canvas[dst_idx] = 0;
                        canvas[dst_idx + 1] = 0;
                        canvas[dst_idx + 2] = 0;
                        canvas[dst_idx + 3] = 0;
                    }
                }
            }
            DisposalMethod::Previous => {
                if let Some(prev) = previous.take() {
                    canvas = prev;
                }
            }
            DisposalMethod::Keep | DisposalMethod::Any => {}
        }
    }

    Ok(DecodedGif { width, height, delays_ms, frames_rgba })
}
```

Acceptance criteria:

- Decoder compiles.
- Errors implement or expose useful messages for command mapping.
- Fully composed RGBA frames are returned.
- Disposal modes are handled.

## Task 4: decode_gif Tauri command

Create `src-tauri/src/commands/decode_gif.rs` and register it with Tauri.

Implementation target:

```rust
use crate::gif::decoder;
use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct DecodedGifDto {
    pub width: u32,
    pub height: u32,
    #[serde(rename = "delaysMs")]
    pub delays_ms: Vec<u32>,
    #[serde(rename = "framesRgba")]
    pub frames_rgba: Vec<Vec<u8>>,
}

#[tauri::command]
pub fn decode_gif(path: String) -> Result<DecodedGifDto, String> {
    let p = PathBuf::from(path);
    let decoded = decoder::decode_path(&p).map_err(|e| e.to_string())?;
    Ok(DecodedGifDto {
        width: decoded.width,
        height: decoded.height,
        delays_ms: decoded.delays_ms,
        frames_rgba: decoded.frames_rgba,
    })
}
```

Acceptance criteria:

- Command is registered in `invoke_handler`.
- TypeScript can invoke `decode_gif`.
- `cargo check` succeeds.

## Task 5: Frontend IPC wrapper and playback store

Create `src/ipc/gif.ts` and `src/store/playbackStore.ts`.

IPC target:

```ts
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

export async function framesToBitmaps(decoded: DecodedGif): Promise<ImageBitmap[]> {
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
```

Store target:

```ts
import { create } from "zustand";

type PlaybackState = {
  width: number;
  height: number;
  frames: ImageBitmap[];
  delaysMs: number[];
  durationMs: number;
  cursorMs: number;
  playing: boolean;
  sourcePath: string | null;

  loadGif: (args: {
    sourcePath: string;
    width: number;
    height: number;
    frames: ImageBitmap[];
    delaysMs: number[];
  }) => void;

  setCursorMs: (ms: number) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
};

export const usePlaybackStore = create<PlaybackState>((set) => ({
  width: 0,
  height: 0,
  frames: [],
  delaysMs: [],
  durationMs: 0,
  cursorMs: 0,
  playing: false,
  sourcePath: null,

  loadGif: ({ sourcePath, width, height, frames, delaysMs }) => {
    set((prev) => {
      for (const bm of prev.frames) bm.close();
      return {
        sourcePath,
        width,
        height,
        frames,
        delaysMs,
        durationMs: delaysMs.reduce((s, d) => s + d, 0),
        cursorMs: 0,
        playing: false,
      };
    });
  },

  setCursorMs: (ms) =>
    set((s) => ({
      cursorMs: s.durationMs > 0 ? ((ms % s.durationMs) + s.durationMs) % s.durationMs : 0,
    })),

  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setPlaying: (playing) => set({ playing }),
}));
```

Acceptance criteria:

- IPC wrapper is typed.
- Bitmap conversion closes previous bitmaps through store replacement.
- Store clamps cursor into GIF duration.

## Task 6: Toolbar component

Create `src/components/Toolbar.tsx` and `src/components/Toolbar.module.css`.

Requirements:

- Use `FolderOpen` from `lucide-react`.
- Use Tauri dialog open API.
- Let user choose one `.gif` file.
- Decode selected GIF and load it into the playback store.
- Show a simple loading state and error state.
- Do not use emoji icons.

Acceptance criteria:

- Opening a GIF loads frames into store.
- Canceling the dialog does nothing.
- UI remains responsive while decoding.

## Task 7: Canvas component

Create `src/components/Canvas.tsx` and `src/components/Canvas.module.css`.

Requirements:

- Render empty state before GIF load.
- Render current frame to a `<canvas>` after load.
- Use `requestAnimationFrame` while playing.
- Use `pickFrameIndex(delaysMs, cursorMs)` to select frame.
- Advance cursor based on elapsed wall-clock time.
- Fit canvas visually into available area while preserving base GIF aspect ratio.

Acceptance criteria:

- Loaded GIF is visible.
- Play state advances frames.
- Paused state keeps the current frame.
- Canvas dimensions match decoded GIF dimensions internally.

## Task 8: Timeline component

Create `src/components/Timeline.tsx` and `src/components/Timeline.module.css`.

Requirements:

- Use `Play` and `Pause` from `lucide-react`.
- Show play/pause button.
- Show range input from `0` to `durationMs`.
- Show current time and total duration.
- Space toggles playback when focus is not in an input.
- Scrubbing updates `cursorMs`.

Acceptance criteria:

- Timeline can scrub loaded GIF.
- Play/pause works by button and space key.
- No emoji icons.

## Task 9: App shell layout

Update `src/App.tsx` and create `src/App.module.css` plus `src/styles/global.css`.

Requirements:

- Canvas-first layout.
- Toolbar at top.
- Canvas fills middle.
- Timeline at bottom.
- Dark, lightweight editor style.
- Remove default Vite/Tauri demo UI.
- No emoji icons.

Acceptance criteria:

- App visually resembles a basic GIF editor shell.
- Empty state is clear.
- Loaded GIF flow is understandable.

## Task 10: Smoke test and tag

Requirements:

- Run frontend tests.
- Run TypeScript build.
- Run Rust check or Tauri build/dev smoke when feasible.
- Manually launch `pnpm tauri dev` if supported by local environment.
- Verify open GIF golden path if a local GIF is available.
- Commit final M1 work.
- Optionally tag `m1-base-gif-loading` only after user approval.

Acceptance criteria:

- Test/build commands pass or blockers are documented.
- M1 user flow is verified as far as the local environment allows.
- Remaining limitations are documented in final response.
