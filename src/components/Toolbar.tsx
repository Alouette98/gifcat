import { useState } from "react";
import { FolderOpen, ImagePlus } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { decodeGif, framesToBitmaps } from "../ipc/gif";
import { usePlaybackStore } from "../store/playbackStore";
import { useProjectStore } from "../store/projectStore";
import {
  createTransform,
  createTiming,
  generateId,
  type ImageOverlay,
} from "../types/overlay";
import styles from "./Toolbar.module.css";

export function Toolbar() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadGif = usePlaybackStore((s) => s.loadGif);
  const durationMs = usePlaybackStore((s) => s.durationMs);
  const setBase = useProjectStore((s) => s.setBase);
  const apply = useProjectStore((s) => s.apply);

  async function handleOpenGif() {
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
      setBase(
        {
          sourcePath: path,
          durationMs: decoded.delaysMs.reduce((s, d) => s + d, 0),
          frameCount: decoded.framesRgba.length,
          width: decoded.width,
          height: decoded.height,
        },
        { width: decoded.width, height: decoded.height },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddImage() {
    setError(null);
    const selected = await open({
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] }],
      multiple: false,
      directory: false,
    });
    if (!selected) return;

    const path = selected as string;
    try {
      const response = await fetch(`asset://localhost/${path}`);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      const overlay: ImageOverlay = {
        id: generateId(),
        type: "image",
        name: path.split("/").pop() || "Image",
        sourcePath: path,
        bitmap,
        naturalWidth: bitmap.width,
        naturalHeight: bitmap.height,
        transform: createTransform(),
        opacity: 1,
        timing: createTiming(durationMs),
        visible: true,
        locked: false,
      };

      apply({ type: "addOverlay", overlay });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className={styles.toolbar}>
      <button onClick={handleOpenGif} disabled={loading}>
        <FolderOpen size={16} />
        {loading ? "Loading..." : "Open GIF"}
      </button>
      {durationMs > 0 && (
        <button onClick={handleAddImage}>
          <ImagePlus size={16} />
          Add Image
        </button>
      )}
      {error && <span className={styles.status}>{error}</span>}
    </div>
  );
}
