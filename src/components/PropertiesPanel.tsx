import { usePlaybackStore } from "../store/playbackStore";
import { useProjectStore } from "../store/projectStore";
import type { Overlay, TextOverlay } from "../types/overlay";
import styles from "./PropertiesPanel.module.css";

export function PropertiesPanel() {
  const selectedId = useProjectStore((s) => s.selectedOverlayId);
  const overlays = useProjectStore((s) => s.project.overlays);
  const apply = useProjectStore((s) => s.apply);
  const durationMs = usePlaybackStore((s) => s.durationMs);

  const overlay = overlays.find((o) => o.id === selectedId);
  if (!overlay) return null;

  function update(patch: Partial<Overlay>) {
    apply({ type: "updateOverlay", id: overlay!.id, patch });
  }

  function updateTransform(key: string, value: number) {
    update({ transform: { ...overlay!.transform, [key]: value } });
  }

  function updateTiming(key: string, value: number) {
    const clamped = Math.max(0, Math.min(durationMs, value));
    update({ timing: { ...overlay!.timing, [key]: clamped } });
  }

  function updateText(patch: Partial<TextOverlay>) {
    apply({ type: "updateOverlay", id: overlay!.id, patch: patch as Partial<Overlay> });
  }

  return (
    <div className={styles.panel}>
      <h3>{overlay.name}</h3>

      <div className={styles.row}>
        <label>X</label>
        <input
          type="number"
          value={Math.round(overlay.transform.x)}
          onChange={(e) => updateTransform("x", Number(e.target.value))}
        />
        <label>Y</label>
        <input
          type="number"
          value={Math.round(overlay.transform.y)}
          onChange={(e) => updateTransform("y", Number(e.target.value))}
        />
      </div>

      <div className={styles.row}>
        <label>Scale</label>
        <input
          type="range"
          min={0.05}
          max={5}
          step={0.05}
          value={overlay.transform.scale}
          onChange={(e) => updateTransform("scale", Number(e.target.value))}
        />
        <span style={{ fontSize: 11, color: "#a6adc8" }}>
          {(overlay.transform.scale * 100).toFixed(0)}%
        </span>
      </div>

      <div className={styles.row}>
        <label>Rotation</label>
        <input
          type="number"
          value={Math.round(overlay.transform.rotationDeg)}
          onChange={(e) => updateTransform("rotationDeg", Number(e.target.value))}
        />
        <span style={{ fontSize: 11, color: "#a6adc8" }}>deg</span>
      </div>

      <div className={styles.row}>
        <label>Opacity</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={overlay.opacity}
          onChange={(e) => update({ opacity: Number(e.target.value) })}
        />
      </div>

      {overlay.type === "text" && (
        <TextProperties overlay={overlay as TextOverlay} update={updateText} />
      )}

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Timing</div>
        <div className={styles.row}>
          <label>Start</label>
          <input
            type="number"
            value={overlay.timing.startMs}
            onChange={(e) => updateTiming("startMs", Number(e.target.value))}
          />
          <label>End</label>
          <input
            type="number"
            value={overlay.timing.endMs}
            onChange={(e) => updateTiming("endMs", Number(e.target.value))}
          />
        </div>

        <div className={styles.row}>
          <label>Fade In</label>
          <input
            type="number"
            min={0}
            value={overlay.timing.fadeInMs}
            onChange={(e) => updateTiming("fadeInMs", Number(e.target.value))}
          />
          <label>Fade Out</label>
          <input
            type="number"
            min={0}
            value={overlay.timing.fadeOutMs}
            onChange={(e) => updateTiming("fadeOutMs", Number(e.target.value))}
          />
        </div>
      </div>

      <button
        className={styles.deleteBtn}
        onClick={() => apply({ type: "removeOverlay", id: overlay.id })}
      >
        Delete Overlay
      </button>
    </div>
  );
}

function TextProperties({
  overlay,
  update,
}: {
  overlay: TextOverlay;
  update: (patch: Partial<TextOverlay>) => void;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Text</div>
      <div className={styles.row}>
        <label>Content</label>
        <input
          type="text"
          value={overlay.text}
          onChange={(e) => update({ text: e.target.value })}
        />
      </div>
      <div className={styles.row}>
        <label>Font</label>
        <select
          value={overlay.fontFamily}
          onChange={(e) => update({ fontFamily: e.target.value })}
        >
          <option value="sans-serif">Sans-serif</option>
          <option value="serif">Serif</option>
          <option value="monospace">Monospace</option>
          <option value="cursive">Cursive</option>
          <option value="Impact">Impact</option>
          <option value="Arial Black">Arial Black</option>
        </select>
      </div>
      <div className={styles.row}>
        <label>Size</label>
        <input
          type="number"
          min={8}
          max={200}
          value={overlay.fontSize}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
        />
      </div>
      <div className={styles.row}>
        <label>Color</label>
        <input
          type="color"
          value={overlay.color}
          onChange={(e) => update({ color: e.target.value })}
        />
        <label>Align</label>
        <select
          value={overlay.align}
          onChange={(e) => update({ align: e.target.value as TextOverlay["align"] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div className={styles.row}>
        <label>Stroke</label>
        <input
          type="color"
          value={overlay.strokeColor}
          onChange={(e) => update({ strokeColor: e.target.value })}
        />
        <input
          type="number"
          min={0}
          max={20}
          value={overlay.strokeWidth}
          onChange={(e) => update({ strokeWidth: Number(e.target.value) })}
        />
      </div>
      <div className={styles.row}>
        <label>Shadow</label>
        <input
          type="color"
          value={overlay.shadowColor}
          onChange={(e) => update({ shadowColor: e.target.value })}
        />
        <input
          type="number"
          min={0}
          max={50}
          value={overlay.shadowBlur}
          onChange={(e) => update({ shadowBlur: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
