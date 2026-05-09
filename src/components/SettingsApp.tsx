import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion, getTauriVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { SlidersHorizontal, Puzzle, Info } from "lucide-react";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "../i18n";
import styles from "./SettingsApp.module.css";

type Tab = "general" | "extensions" | "about";

export function SettingsApp() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className={styles.root}>
      <aside className={styles.rail}>
        <div className={styles.brand}>{t("settings.title")}</div>
        <nav className={styles.nav}>
          <RailItem
            active={tab === "general"}
            onClick={() => setTab("general")}
            icon={<SlidersHorizontal size={15} />}
            label={t("settings.tabs.general")}
          />
          <RailItem
            active={tab === "extensions"}
            onClick={() => setTab("extensions")}
            icon={<Puzzle size={15} />}
            label={t("settings.tabs.extensions")}
          />
          <RailItem
            active={tab === "about"}
            onClick={() => setTab("about")}
            icon={<Info size={15} />}
            label={t("settings.tabs.about")}
          />
        </nav>
      </aside>
      <main className={styles.content}>
        {tab === "general" && <GeneralTab />}
        {tab === "extensions" && <ExtensionsTab />}
        {tab === "about" && <AboutTab />}
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
  const { t, i18n } = useTranslation();
  const [launchAtLogin, setLaunchAtLogin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
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

  function changeLanguage(code: LanguageCode) {
    i18n.changeLanguage(code);
  }

  const currentLang = (i18n.resolvedLanguage ?? "en") as LanguageCode;

  return (
    <div className={styles.pane}>
      <h2 className={styles.paneTitle}>{t("settings.general.title")}</h2>

      <section className={styles.section}>
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>{t("settings.general.language")}</div>
            <div className={styles.rowHint}>{t("settings.general.languageHint")}</div>
          </div>
          <select
            className={styles.select}
            value={currentLang}
            onChange={(e) => changeLanguage(e.target.value as LanguageCode)}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.divider} />
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>{t("settings.general.launchAtLogin")}</div>
            <div className={styles.rowHint}>{t("settings.general.launchAtLoginHint")}</div>
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
  license: string;
  hasNote?: boolean;
}

const EXTENSIONS: ExtensionMeta[] = [
  { id: "ffmpeg", license: "LGPL / GPL" },
  { id: "gifski", license: "AGPL-3.0", hasNote: true },
];

function ExtensionsTab() {
  const { t } = useTranslation();
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
      <h2 className={styles.paneTitle}>{t("settings.extensions.title")}</h2>
      <p className={styles.paneSubtitle}>{t("settings.extensions.subtitle")}</p>

      <div className={styles.cards}>
        {EXTENSIONS.map((ext) => {
          const status = statuses[ext.id];
          const installing = busy === ext.id;
          return (
            <article key={ext.id} className={styles.card}>
              <header className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>{t(`settings.extensions.${ext.id}.name`)}</div>
                  <div className={styles.cardDesc}>{t(`settings.extensions.${ext.id}.description`)}</div>
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
                {t("settings.extensions.license")}: <span>{ext.license}</span>
                {ext.hasNote && (
                  <span className={styles.licenseNote}>
                    {" "}· {t(`settings.extensions.${ext.id}.note`)}
                  </span>
                )}
              </div>

              <div className={styles.cardActions}>
                {status?.installed ? (
                  <button
                    className={styles.secondaryBtn}
                    onClick={() => install(ext.id)}
                    disabled={installing}
                  >
                    {installing
                      ? t("settings.extensions.reinstalling")
                      : t("settings.extensions.reinstall")}
                  </button>
                ) : (
                  <button
                    className={styles.primaryBtn}
                    onClick={() => install(ext.id)}
                    disabled={installing}
                  >
                    {installing
                      ? t("settings.extensions.installing")
                      : t("settings.extensions.install")}
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
  const { t } = useTranslation();
  if (!status) {
    return <span className={styles.badge}>{t("settings.extensions.checking")}</span>;
  }
  if (status.installed) {
    return (
      <span className={`${styles.badge} ${styles.badgeOk}`}>
        {t("settings.extensions.installed")}
      </span>
    );
  }
  return (
    <span className={`${styles.badge} ${styles.badgeWarn}`}>
      {t("settings.extensions.notInstalled")}
    </span>
  );
}

function AboutTab() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>("—");
  const [tauriVersion, setTauriVersion] = useState<string>("—");

  useEffect(() => {
    (async () => {
      try {
        setVersion(await getVersion());
      } catch {
        setVersion("dev");
      }
      try {
        setTauriVersion(await getTauriVersion());
      } catch {
        setTauriVersion("—");
      }
    })();
  }, []);

  return (
    <div className={styles.pane}>
      <h2 className={styles.paneTitle}>{t("settings.about.title")}</h2>
      <div className={styles.aboutHero}>
        <div className={styles.aboutName}>gifcat</div>
        <div className={styles.aboutTagline}>{t("settings.about.tagline")}</div>
      </div>

      <section className={styles.section}>
        <div className={styles.row}>
          <div className={styles.rowLabel}>{t("settings.about.version")}</div>
          <div className={styles.rowValue}>{version}</div>
        </div>
        <div className={styles.divider} />
        <div className={styles.row}>
          <div className={styles.rowLabel}>{t("settings.about.build")}</div>
          <div className={styles.rowValue}>Tauri {tauriVersion}</div>
        </div>
        <div className={styles.divider} />
        <div className={styles.row}>
          <div className={styles.rowLabel}>{t("settings.about.license")}</div>
          <div className={styles.rowValue}>MIT</div>
        </div>
      </section>
    </div>
  );
}
