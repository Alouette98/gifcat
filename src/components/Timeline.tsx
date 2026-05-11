import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Pause, Eye, EyeOff, Lock, Unlock, Trash2, Type, Image as ImageIcon, Film } from "lucide-react";
import { usePlaybackStore } from "../store/playbackStore";
import { useProjectStore } from "../store/projectStore";
import type { Overlay } from "../types/overlay";
import styles from "./Timeline.module.css";

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const frac = Math.floor((ms % 1000) / 10);
  return `${s}.${frac.toString().padStart(2, "0")}s`;
}

type DragMode = "move" | "left" | "right";

type DragState = {
  id: string;
  mode: DragMode;
  startPxX: number;
  origStart: number;
  origEnd: number;
};

export function Timeline() {
  const { t } = useTranslation();
  const { playing, cursorMs, durationMs, togglePlay, setCursorMs } =
    usePlaybackStore();
  const overlays = useProjectStore((s) => s.project.overlays);
  const selectedId = useProjectStore((s) => s.selectedOverlayId);
  const selectOverlay = useProjectStore((s) => s.selectOverlay);
  const apply = useProjectStore((s) => s.apply);

  const trackRef = useRef<HTMLDivElement>(null);
  const headerScrubRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

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

  useEffect(() => {
    if (!drag) return;
    const trackEl = trackRef.current;
    if (!trackEl) return;
    const trackW = trackEl.getBoundingClientRect().width;
    const minClipMs = 50;
    let raf = 0;
    let pending: { start: number; end: number } | null = null;

    function flush() {
      raf = 0;
      if (!pending || !drag) return;
      const store = useProjectStore.getState();
      const ov = store.project.overlays.find((o) => o.id === drag.id);
      if (!ov) return;
      store.applyTransient({
        type: "updateOverlay",
        id: drag.id,
        patch: {
          timing: {
            ...ov.timing,
            startMs: pending.start,
            endMs: pending.end,
          },
        },
      });
      pending = null;
    }

    function onMove(e: MouseEvent) {
      if (!drag) return;
      const dxPx = e.clientX - drag.startPxX;
      const dxMs = (dxPx / trackW) * durationMs;
      let nextStart = drag.origStart;
      let nextEnd = drag.origEnd;

      if (drag.mode === "move") {
        const clipLen = drag.origEnd - drag.origStart;
        nextStart = Math.max(0, Math.min(durationMs - clipLen, drag.origStart + dxMs));
        nextEnd = nextStart + clipLen;
      } else if (drag.mode === "left") {
        nextStart = Math.max(0, Math.min(drag.origEnd - minClipMs, drag.origStart + dxMs));
      } else if (drag.mode === "right") {
        nextEnd = Math.max(drag.origStart + minClipMs, Math.min(durationMs, drag.origEnd + dxMs));
      }

      pending = { start: Math.round(nextStart), end: Math.round(nextEnd) };
      if (raf === 0) raf = requestAnimationFrame(flush);
    }

    function onUp() {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        flush();
      }
      useProjectStore.getState().commitTransient();
      setDrag(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [drag, durationMs]);

  if (durationMs === 0) return null;

  const cursorPct = (cursorMs / durationMs) * 100;

  function startDrag(e: React.MouseEvent, ov: Overlay, mode: DragMode) {
    e.stopPropagation();
    e.preventDefault();
    selectOverlay(ov.id);
    useProjectStore.getState().beginTransient();
    setDrag({
      id: ov.id,
      mode,
      startPxX: e.clientX,
      origStart: ov.timing.startMs,
      origEnd: ov.timing.endMs,
    });
  }

  function startScrub(getRect: () => DOMRect) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      usePlaybackStore.getState().setPlaying(false);
      const rect = getRect();
      const update = (clientX: number) => {
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const ms = Math.max(0, Math.min(durationMs - 1, pct * durationMs));
        usePlaybackStore.setState({ cursorMs: ms });
      };
      update(e.clientX);
      function onMove(ev: MouseEvent) { update(ev.clientX); }
      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
  }

  function toggleVisible(ov: Overlay) {
    apply({ type: "updateOverlay", id: ov.id, patch: { visible: !ov.visible } });
  }
  function toggleLock(ov: Overlay) {
    apply({ type: "updateOverlay", id: ov.id, patch: { locked: !ov.locked } });
  }
  function deleteOverlay(ov: Overlay) {
    apply({ type: "removeOverlay", id: ov.id });
    if (selectedId === ov.id) selectOverlay(null);
  }

  return (
    <div className={styles.timeline}>
      <div className={styles.header}>
        <button className={styles.playBtn} onClick={togglePlay}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div
          ref={headerScrubRef}
          className={styles.scrubber}
          onMouseDown={startScrub(() => headerScrubRef.current!.getBoundingClientRect())}
        >
          <div className={styles.scrubTrack} />
          <div className={styles.scrubFill} style={{ width: `${cursorPct}%` }} />
          <div className={styles.scrubThumb} style={{ left: `${cursorPct}%` }} />
        </div>
        <span className={styles.time}>
          {formatMs(cursorMs)} / {formatMs(durationMs)}
        </span>
      </div>

      <div className={styles.tracks}>
        <div className={styles.labels}>
          <div className={styles.labelBase}>{t("timeline.base")}</div>
          {overlays.map((ov) => (
            <div
              key={ov.id}
              className={`${styles.label} ${ov.id === selectedId ? styles.labelActive : ""}`}
              onClick={() => selectOverlay(ov.id)}
            >
              <span className={styles.labelIcon}>
                {ov.type === "text" ? <Type size={12} /> : ov.type === "gif" ? <Film size={12} /> : <ImageIcon size={12} />}
              </span>
              <span className={styles.labelText} title={ov.name}>{ov.name}</span>
              <button
                className={styles.iconBtn}
                onClick={(e) => { e.stopPropagation(); toggleVisible(ov); }}
                title={ov.visible ? "hide" : "show"}
              >
                {ov.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <button
                className={styles.iconBtn}
                onClick={(e) => { e.stopPropagation(); toggleLock(ov); }}
                title={ov.locked ? "unlock" : "lock"}
              >
                {ov.locked ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
              <button
                className={`${styles.iconBtn} ${styles.danger}`}
                onClick={(e) => { e.stopPropagation(); deleteOverlay(ov); }}
                title="delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <div
          className={styles.lanes}
          ref={trackRef}
          onMouseDown={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest(`.${styles.clip}`)) return;
            startScrub(() => trackRef.current!.getBoundingClientRect())(e);
          }}
        >
          <div className={styles.cursor} style={{ left: `${cursorPct}%` }} />

          <div className={`${styles.lane} ${styles.laneBase}`}>
            <div className={styles.baseClip} />
          </div>

          {overlays.map((ov) => {
            const startPct = (ov.timing.startMs / durationMs) * 100;
            const widthPct = ((ov.timing.endMs - ov.timing.startMs) / durationMs) * 100;
            const fadeInPct = ov.timing.fadeInMs > 0
              ? Math.min(100, (ov.timing.fadeInMs / Math.max(1, ov.timing.endMs - ov.timing.startMs)) * 100)
              : 0;
            const fadeOutPct = ov.timing.fadeOutMs > 0
              ? Math.min(100, (ov.timing.fadeOutMs / Math.max(1, ov.timing.endMs - ov.timing.startMs)) * 100)
              : 0;
            const active = ov.id === selectedId;
            const dim = !ov.visible;

            return (
              <div key={ov.id} className={styles.lane}>
                <div
                  className={`${styles.clip} ${active ? styles.clipActive : ""} ${dim ? styles.clipDim : ""} ${styles[`clip_${ov.type}`] ?? ""}`}
                  style={{
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                    background: fadeInPct + fadeOutPct > 0
                      ? `linear-gradient(to right, transparent 0%, currentColor ${fadeInPct}%, currentColor ${100 - fadeOutPct}%, transparent 100%)`
                      : undefined,
                  }}
                  onMouseDown={(e) => startDrag(e, ov, "move")}
                  onClick={(e) => { e.stopPropagation(); selectOverlay(ov.id); }}
                  title={`${formatMs(ov.timing.startMs)} – ${formatMs(ov.timing.endMs)}`}
                >
                  <div
                    className={`${styles.handle} ${styles.handleLeft}`}
                    onMouseDown={(e) => startDrag(e, ov, "left")}
                  />
                  <div className={styles.clipLabel}>{ov.name}</div>
                  <div
                    className={`${styles.handle} ${styles.handleRight}`}
                    onMouseDown={(e) => startDrag(e, ov, "right")}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.tracksGutter} />
      </div>
    </div>
  );
}
