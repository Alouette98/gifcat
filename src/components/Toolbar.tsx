import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, ImagePlus, Type, Film, Stamp, Download, Settings } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { decodeGif, framesToBitmaps } from "../ipc/gif";
import {
  createExportTempdir,
  exportGif,
  writeExportFrame,
} from "../ipc/export";
import { rasterizeFrames } from "../engine/rasterize";
import { onMenuEvent } from "../ipc/menu";
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

const EXPORT_FPS = 25;

export function Toolbar() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [quality, setQuality] = useState<"standard" | "high">("standard");
  const loadGif = usePlaybackStore((s) => s.loadGif);
  const durationMs = usePlaybackStore((s) => s.durationMs);
  const setBase = useProjectStore((s) => s.setBase);
  const apply = useProjectStore((s) => s.apply);

  useEffect(() => {
    const offs: Array<() => void> = [];
    offs.push(onMenuEvent("file:open", () => handleOpenGif()));
    offs.push(onMenuEvent("file:export", () => handleExport()));
    offs.push(onMenuEvent("view:add_image", () => handleAddImage()));
    offs.push(onMenuEvent("view:add_text", () => handleAddText()));
    offs.push(onMenuEvent("view:add_gif", () => handleAddGif()));
    offs.push(onMenuEvent("view:watermark", () => handleAddWatermark()));
    offs.push(
      onMenuEvent("view:play_pause", () => {
        const s = usePlaybackStore.getState();
        s.setPlaying(!s.playing);
      }),
    );
    offs.push(onMenuEvent("edit:undo", () => useProjectStore.getState().undo()));
    offs.push(onMenuEvent("edit:redo", () => useProjectStore.getState().redo()));
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setStatus(null);
    const project = useProjectStore.getState().project;
    const playback = usePlaybackStore.getState();
    if (!project.base || playback.frames.length === 0) return;

    const outputPath = await save({
      filters: [{ name: "GIF", extensions: ["gif"] }],
      defaultPath: "output.gif",
    });
    if (!outputPath) return;

    setLoading(true);
    try {
      const framesDir = await createExportTempdir();

      setStatus(t("toolbar.rasterizing", { done: 0, total: 0 }));
      const frames = await rasterizeFrames({
        width: project.canvas.width,
        height: project.canvas.height,
        baseFrames: playback.frames,
        baseDelaysMs: playback.delaysMs,
        totalDurationMs: playback.durationMs,
        fps: EXPORT_FPS,
        overlays: project.overlays.filter((o) => o.visible),
        onProgress: (done, total) => {
          setStatus(t("toolbar.rasterizing", { done, total }));
        },
      });

      setStatus(t("toolbar.writingFrames", { count: frames.length }));
      for (const f of frames) {
        await writeExportFrame(framesDir, f.index, f.png);
      }

      setStatus(t("toolbar.encoding"));
      await exportGif({
        outputPath,
        framesDir,
        fps: EXPORT_FPS,
        quality,
      });
      setStatus(t("toolbar.done"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.toolbar}>
      <button onClick={handleOpenGif} disabled={loading} title={t("toolbar.openGif")}>
        <FolderOpen size={16} />
        <span className={styles.label}>
          {loading ? t("toolbar.loading") : t("toolbar.openGif")}
        </span>
      </button>
      {durationMs > 0 && (
        <>
          <button onClick={handleAddImage} title={t("toolbar.addImage")}>
            <ImagePlus size={16} />
            <span className={styles.label}>{t("toolbar.addImage")}</span>
          </button>
          <button onClick={handleAddText} title={t("toolbar.addText")}>
            <Type size={16} />
            <span className={styles.label}>{t("toolbar.addText")}</span>
          </button>
          <button onClick={handleAddGif} title={t("toolbar.addGif")}>
            <Film size={16} />
            <span className={styles.label}>{t("toolbar.addGif")}</span>
          </button>
          <button onClick={handleAddWatermark} title={t("toolbar.watermark")}>
            <Stamp size={16} />
            <span className={styles.label}>{t("toolbar.watermark")}</span>
          </button>
          <label className={styles.quality} title={t("toolbar.quality")}>
            <span className={styles.label}>{t("toolbar.quality")}</span>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as "standard" | "high")}
            >
              <option value="standard">{t("toolbar.qualityStandard")}</option>
              <option value="high">{t("toolbar.qualityHigh")}</option>
            </select>
          </label>
          <button onClick={handleExport} disabled={loading} title={t("toolbar.export")}>
            <Download size={16} />
            <span className={styles.label}>
              {loading ? t("toolbar.exporting") : t("toolbar.export")}
            </span>
          </button>
        </>
      )}
      {error && <span className={styles.status}>{error}</span>}
      {!error && status && <span className={styles.status}>{status}</span>}
      <button
        className={styles.iconBtn}
        onClick={() => invoke("open_settings_window")}
        title={t("toolbar.settings")}
      >
        <Settings size={16} />
      </button>
    </div>
  );
}
