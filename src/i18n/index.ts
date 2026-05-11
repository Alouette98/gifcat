import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { listen, emit } from "@tauri-apps/api/event";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";
import ja from "./locales/ja.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
  { code: "ja", label: "日本語" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const LANG_EVENT = "gifcat://language-changed";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      "zh-CN": { translation: zhCN },
      zh: { translation: zhCN },
      ja: { translation: ja },
    },
    fallbackLng: "zh-CN",
    supportedLngs: ["en", "zh-CN", "zh", "ja"],
    nonExplicitSupportedLngs: true,
    load: "currentOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "gifcat-lang",
    },
  });

i18n.on("languageChanged", (lng) => {
  emit(LANG_EVENT, lng).catch(() => {});
});

listen<string>(LANG_EVENT, (e) => {
  if (e.payload && e.payload !== i18n.resolvedLanguage) {
    i18n.changeLanguage(e.payload);
  }
}).catch(() => {});

export default i18n;
