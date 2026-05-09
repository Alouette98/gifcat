import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import i18n from "../i18n";

export type MenuEventId =
  | "app:settings"
  | "file:open"
  | "file:export"
  | "edit:undo"
  | "edit:redo"
  | "view:play_pause"
  | "view:add_image"
  | "view:add_text"
  | "view:add_gif"
  | "view:watermark";

type Handler = () => void;
const handlers = new Map<MenuEventId, Handler>();

export function onMenuEvent(id: MenuEventId, handler: Handler): () => void {
  handlers.set(id, handler);
  return () => {
    if (handlers.get(id) === handler) handlers.delete(id);
  };
}

listen<{ id: string }>("gifcat://menu", (e) => {
  const h = handlers.get(e.payload.id as MenuEventId);
  if (h) h();
}).catch(() => {});

function buildLabels() {
  const t = i18n.getFixedT(i18n.resolvedLanguage ?? "en");
  return {
    app_name: "gifcat",
    about: t("menu.about"),
    settings: t("menu.settings"),
    services: t("menu.services"),
    hide: t("menu.hide"),
    hide_others: t("menu.hideOthers"),
    show_all: t("menu.showAll"),
    quit: t("menu.quit"),
    file: t("menu.file"),
    open_gif: t("menu.openGif"),
    export: t("menu.export"),
    close: t("menu.close"),
    edit: t("menu.edit"),
    undo: t("menu.undo"),
    redo: t("menu.redo"),
    cut: t("menu.cut"),
    copy: t("menu.copy"),
    paste: t("menu.paste"),
    select_all: t("menu.selectAll"),
    view: t("menu.view"),
    play_pause: t("menu.playPause"),
    add_image: t("menu.addImage"),
    add_text: t("menu.addText"),
    add_gif: t("menu.addGif"),
    watermark: t("menu.watermark"),
    window: t("menu.window"),
    minimize: t("menu.minimize"),
    zoom: t("menu.zoom"),
    bring_all_to_front: t("menu.bringAllToFront"),
    help: t("menu.help"),
    repository: t("menu.repository"),
    report_issue: t("menu.reportIssue"),
  };
}

export async function rebuildMenu() {
  try {
    await invoke("rebuild_app_menu", { labels: buildLabels() });
  } catch (e) {
    console.error("rebuild menu failed", e);
  }
}

i18n.on("languageChanged", () => {
  rebuildMenu();
});

if (i18n.isInitialized) {
  rebuildMenu();
} else {
  i18n.on("initialized", () => rebuildMenu());
}
