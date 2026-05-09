import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { SlidersHorizontal, Puzzle } from "lucide-react";
import styles from "./SettingsApp.module.css";

type Tab = "general" | "extensions";

export function SettingsApp() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className={styles.root}>
      <aside className={styles.rail}>
        <div className={styles.brand}>Settings</div>
        <nav className={styles.nav}>
          <RailItem
            active={tab === "general"}
            onClick={() => setTab("general")}
            icon={<SlidersHorizontal size={15} />}
            label="General"
          />
          <RailItem
            active={tab === "extensions"}
            onClick={() => setTab("extensions")}
            icon={<Puzzle size={15} />}
            label="Extensions"
          />
        </nav>
      </aside>
      <main className={styles.content}>
        {tab === "general" && <GeneralTab />}
        {tab === "extensions" && <ExtensionsTab />}
      </main>
    </div>
  );
}

function RailItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      className={`${styles.railItem} ${active ? styles.railItemActive : ""}`}
      onClick={onClick}
    >
      <span className={styles.railIcon}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function GeneralTab() {
  const [version, setVersion] = useState<string>("—");
  const [launchAtLogin, setLaunchAtLogin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setVersion(await getVersion());
      } catch {
        setVersion("dev");
      }
      try {
        const enabled = await invoke<boolean>("autostart_is_enabled");
        setLaunchAtLogin(enabled);
      } catch {
        // plugin not available
      }
      setLoading(false);
    })();
  }, []);

  async function toggleAutostart() {
    const next = !launchAtLogin;
    try {
      await invoke(next ? "autostart_enable" : "autostart_disable");
      setLaunchAtLogin(next);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className={styles.pane}>
      <h2 className={styles.paneTitle}>General</h2>

      <section className={styles.section}>
        <div className={styles.row}>
          <div className={styles.rowLabel}>Version</div>
          <div className={styles.rowValue}>{version}</div>
        </div>
        <div className={styles.divider} />
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>Launch at login</div>
            <div className={styles.rowHint}>
              Open gifcat automatically when you sign in.
            </div>
          </div>
          <Toggle
            checked={launchAtLogin}
            disabled={loading}
            onChange={toggleAutostart}
          />
        </div>
      </section>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      className={`${styles.toggle} ${checked ? styles.toggleOn : ""}`}
      onClick={onChange}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

interface ExtensionStatus {
  name: string;
  installed: boolean;
  version: string | null;
  path: string | null;
}

interface ExtensionMeta {
  id: "ffmpeg" | "gifski";
  name: string;
  description: string;
  license: string;
  licenseNote?: string;
}

const EXTENSIONS: ExtensionMeta[] = [
  {
    id: "ffmpeg",
    name: "ffmpeg",
    description: "Required for standard GIF export.",
    license: "LGPL / GPL",
  },
  {
    id: "gifski",
    name: "gifski",
    description: "Optional. Higher-quality GIF encoder for the High Quality export mode.",
    license: "AGPL-3.0",
    licenseNote:
      "Installed via your local package manager; gifcat does not distribute the binary.",
  },
];

function ExtensionsTab() {
  const [statuses, setStatuses] = useState<Record<string, ExtensionStatus>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const out: Record<string, ExtensionStatus> = {};
    for (const ext of EXTENSIONS) {
      try {
        out[ext.id] = await invoke<ExtensionStatus>("extension_status", {
          name: ext.id,
        });
      } catch {
        out[ext.id] = { name: ext.id, installed: false, version: null, path: null };
      }
    }
    setStatuses(out);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function install(id: string) {
    setBusy(id);
    try {
      await invoke("extension_install", { name: id });
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.pane}>
      <h2 className={styles.paneTitle}>Extensions</h2>
      <p className={styles.paneSubtitle}>
        Runtime tools gifcat can call when you export. Install through Homebrew; the
        exact command is shown before it runs.
      </p>

      <div className={styles.cards}>
        {EXTENSIONS.map((ext) => {
          const status = statuses[ext.id];
          const installing = busy === ext.id;
          return (
            <article key={ext.id} className={styles.card}>
              <header className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>{ext.name}</div>
                  <div className={styles.cardDesc}>{ext.description}</div>
                </div>
                <StatusBadge status={status} />
              </header>

              {status?.installed && status.version && (
                <div className={styles.meta}>{status.version}</div>
              )}
              {status?.path && (
                <div className={styles.metaPath}>{status.path}</div>
              )}

              <div className={styles.licenseLine}>
                License: <span>{ext.license}</span>
                {ext.licenseNote && (
                  <span className={styles.licenseNote}> · {ext.licenseNote}</span>
                )}
              </div>

              <div className={styles.cardActions}>
                {status?.installed ? (
                  <button
                    className={styles.secondaryBtn}
                    onClick={() => install(ext.id)}
                    disabled={installing}
                  >
                    {installing ? "Reinstalling…" : "Reinstall"}
                  </button>
                ) : (
                  <button
                    className={styles.primaryBtn}
                    onClick={() => install(ext.id)}
                    disabled={installing}
                  >
                    {installing ? "Installing…" : "Install via Homebrew"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: ExtensionStatus }) {
  if (!status) {
    return <span className={styles.badge}>Checking…</span>;
  }
  if (status.installed) {
    return <span className={`${styles.badge} ${styles.badgeOk}`}>Installed</span>;
  }
  return <span className={`${styles.badge} ${styles.badgeWarn}`}>Not installed</span>;
}
