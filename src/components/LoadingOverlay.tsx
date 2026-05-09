import { useTranslation } from "react-i18next";
import { useUIStore } from "../store/uiStore";
import catGif from "../assets/loading-cat.gif";
import styles from "./LoadingOverlay.module.css";

export function LoadingOverlay() {
  const { t } = useTranslation();
  const loading = useUIStore((s) => s.loading);
  const title = useUIStore((s) => s.loadingTitle);
  const detail = useUIStore((s) => s.loadingDetail);
  const progress = useUIStore((s) => s.loadingProgress);

  if (!loading) return null;

  const pct =
    typeof progress === "number" ? Math.max(0, Math.min(1, progress)) : null;

  return (
    <div className={styles.backdrop} role="status" aria-live="polite">
      <div className={styles.card}>
        <img className={styles.cat} src={catGif} alt={t("loading.alt")} />
        <div className={styles.title}>{title}</div>
        {detail && <div className={styles.detail}>{detail}</div>}
        {pct !== null && (
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${(pct * 100).toFixed(1)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
