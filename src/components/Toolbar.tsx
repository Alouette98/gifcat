import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { decodeGif, framesToBitmaps } from "../ipc/gif";
import { usePlaybackStore } from "../store/playbackStore";
import styles from "./Toolbar.module.css";

export function Toolbar() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadGif = usePlaybackStore((s) => s.loadGif);

  async function handleOpen() {
    setError(null);
    const selected = await open({
      filters: [{ name: "GIF", extensions: ["gif"] }],
      multiple: false,
      directory: false,
    });
    if (!selected) return;

    const path = selected as string;
    setLoading(true);
    try {
      const decoded = await decodeGif(path);
      const frames = await framesToBitmaps(decoded);
      loadGif({
        sourcePath: path,
        width: decoded.width,
        height: decoded.height,
        frames,
        delaysMs: decoded.delaysMs,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.toolbar}>
      <button onClick={handleOpen} disabled={loading}>
        <FolderOpen size={16} />
        {loading ? "Loading..." : "Open GIF"}
      </button>
      {error && <span className={styles.status}>{error}</span>}
    </div>
  );
}
