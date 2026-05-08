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
      cursorMs:
        s.durationMs > 0
          ? ((ms % s.durationMs) + s.durationMs) % s.durationMs
          : 0,
    })),

  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setPlaying: (playing) => set({ playing }),
}));
