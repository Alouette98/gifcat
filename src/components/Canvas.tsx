import { useRef, useEffect } from "react";
import { usePlaybackStore } from "../store/playbackStore";
import { pickFrameIndex } from "../engine/framePicker";
import styles from "./Canvas.module.css";

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const { frames, delaysMs, width, height, playing, cursorMs, setCursorMs } =
    usePlaybackStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frames.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      const state = usePlaybackStore.getState();
      const idx = pickFrameIndex(state.delaysMs, state.cursorMs);
      const frame = state.frames[idx];
      if (frame && ctx) {
        ctx.clearRect(0, 0, state.width, state.height);
        ctx.drawImage(frame, 0, 0);
      }
    }

    function loop(timestamp: number) {
      const state = usePlaybackStore.getState();
      if (state.playing) {
        if (lastTimeRef.current === 0) {
          lastTimeRef.current = timestamp;
        }
        const delta = timestamp - lastTimeRef.current;
        lastTimeRef.current = timestamp;
        setCursorMs(state.cursorMs + delta);
      } else {
        lastTimeRef.current = 0;
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [frames, delaysMs, width, height, playing, cursorMs, setCursorMs]);

  if (frames.length === 0) {
    return (
      <div className={styles.canvasWrap}>
        <span className={styles.empty}>Open a GIF to begin</span>
      </div>
    );
  }

  return (
    <div className={styles.canvasWrap}>
      <canvas ref={canvasRef} width={width} height={height} />
    </div>
  );
}
