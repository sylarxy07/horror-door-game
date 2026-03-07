import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LANG,
  LANG_STORAGE_KEY,
  SUPPORTED_LANGS,
  translations,
  type Lang,
  type TranslationValue,
} from "./translations";

type TranslateParams = Record<string, string | number>;

type I18nContextValue = {
  currentLang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: TranslateParams) => string;
  tLines: (key: string) => readonly string[];
};

const I18nContext = createContext<I18nContextValue | null>(null);

const isSupportedLang = (value: string): value is Lang =>
  (SUPPORTED_LANGS as readonly string[]).includes(value);

const interpolate = (template: string, params?: TranslateParams) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => String(params[token] ?? `{${token}}`));
};

const getTranslation = (lang: Lang, key: string): TranslationValue | undefined =>
  translations[lang][key] ?? translations.en[key] ?? translations.tr[key];

const normalizeLines = (value: TranslationValue | undefined): readonly string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value as string];
};

function getInitialLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (stored && isSupportedLang(stored)) return stored;
  return DEFAULT_LANG;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [currentLang, setCurrentLang] = useState<Lang>(() => getInitialLang());

  const setLang = useCallback((lang: Lang) => {
    setCurrentLang(lang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: TranslateParams) => {
      const value = getTranslation(currentLang, key);
      if (!value) return key;
      if (Array.isArray(value)) return interpolate(value.join("\n"), params);
      return interpolate(value as string, params);
    },
    [currentLang]
  );

  const tLines = useCallback(
    (key: string) => {
      const value = getTranslation(currentLang, key);
      return normalizeLines(value);
    },
    [currentLang]
  );

  const contextValue = useMemo<I18nContextValue>(
    () => ({ currentLang, setLang, t, tLines }),
    [currentLang, setLang, t, tLines]
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

/* eslint-disable react-refresh/only-export-components */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return ctx;
}
