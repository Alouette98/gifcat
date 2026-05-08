import { useState } from "react";
import { FolderOpen, ImagePlus, Type, Film, Stamp, Download } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { decodeGif, framesToBitmaps } from "../ipc/gif";
import { exportGif } from "../ipc/export";
import { usePlaybackStore } from "../store/playbackStore";
import { useProjectStore } from "../store/projectStore";
import {
  createTransform,
  createTiming,
  generateId,
  type ImageOverlay,
  type TextOverlay,
  type GifOverlay,
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

  function handleAddText() {
    const canvas = useProjectStore.getState().project.canvas;
    const overlay: TextOverlay = {
      id: generateId(),
      type: "text",
      name: "Text",
      text: "Your text",
      fontFamily: "sans-serif",
      fontSize: 48,
      color: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 0,
      shadowColor: "rgba(0,0,0,0.5)",
      shadowBlur: 0,
      align: "center",
      transform: createTransform(canvas.width / 2, canvas.height / 2),
      opacity: 1,
      timing: createTiming(durationMs),
      visible: true,
      locked: false,
    };
    apply({ type: "addOverlay", overlay });
  }

  async function handleAddGif() {
    setError(null);
    const selected = await open({
      filters: [{ name: "GIF", extensions: ["gif"] }],
      multiple: false,
      directory: false,
    });
    if (!selected) return;

    const path = selected as string;
    try {
      const decoded = await decodeGif(path);
      const bitmaps = await framesToBitmaps(decoded);

      const overlay: GifOverlay = {
        id: generateId(),
        type: "gif",
        name: path.split("/").pop() || "GIF",
        sourcePath: path,
        frames: bitmaps,
        delaysMs: decoded.delaysMs,
        naturalWidth: decoded.width,
        naturalHeight: decoded.height,
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

  function handleAddWatermark() {
    const canvas = useProjectStore.getState().project.canvas;
    const margin = 20;
    const overlay: TextOverlay = {
      id: generateId(),
      type: "text",
      name: "Watermark",
      text: "gifcat",
      fontFamily: "sans-serif",
      fontSize: 24,
      color: "rgba(255,255,255,0.5)",
      strokeColor: "rgba(0,0,0,0.3)",
      strokeWidth: 1,
      shadowColor: "rgba(0,0,0,0)",
      shadowBlur: 0,
      align: "right",
      transform: createTransform(
        canvas.width - margin - 40,
        canvas.height - margin - 12,
      ),
      opacity: 0.5,
      timing: createTiming(durationMs),
      visible: true,
      locked: false,
    };
    apply({ type: "addOverlay", overlay });
  }

  async function handleExport() {
    setError(null);
    const project = useProjectStore.getState().project;
    if (!project.base) return;

    const outputPath = await save({
      filters: [{ name: "GIF", extensions: ["gif"] }],
      defaultPath: "output.gif",
    });
    if (!outputPath) return;

    setLoading(true);
    try {
      await exportGif({
        basePath: project.base.sourcePath,
        outputPath,
        width: project.canvas.width,
        height: project.canvas.height,
        overlays: project.overlays,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.toolbar}>
      <button onClick={handleOpenGif} disabled={loading}>
        <FolderOpen size={16} />
        {loading ? "Loading..." : "Open GIF"}
      </button>
      {durationMs > 0 && (
        <>
          <button onClick={handleAddImage}>
            <ImagePlus size={16} />
            Add Image
          </button>
          <button onClick={handleAddText}>
            <Type size={16} />
            Add Text
          </button>
          <button onClick={handleAddGif}>
            <Film size={16} />
            Add GIF
          </button>
          <button onClick={handleAddWatermark}>
            <Stamp size={16} />
            Watermark
          </button>
          <button onClick={handleExport} disabled={loading}>
            <Download size={16} />
            {loading ? "Exporting..." : "Export"}
          </button>
        </>
      )}
      {error && <span className={styles.status}>{error}</span>}
    </div>
  );
}
