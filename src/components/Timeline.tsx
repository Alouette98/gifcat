import { useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { usePlaybackStore } from "../store/playbackStore";
import styles from "./Timeline.module.css";

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const frac = Math.floor((ms % 1000) / 10);
  return `${s}.${frac.toString().padStart(2, "0")}s`;
}

export function Timeline() {
  const { playing, cursorMs, durationMs, togglePlay, setCursorMs } =
    usePlaybackStore();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.code === "Space" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [togglePlay]);

  if (durationMs === 0) return null;

  return (
    <div className={styles.timeline}>
      <button onClick={togglePlay}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <input
        type="range"
        className={styles.scrubber}
        min={0}
        max={durationMs}
        value={cursorMs}
        onChange={(e) => setCursorMs(Number(e.target.value))}
      />
      <span className={styles.time}>
        {formatMs(cursorMs)} / {formatMs(durationMs)}
      </span>
    </div>
  );
}
