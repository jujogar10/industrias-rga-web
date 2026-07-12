import es from "./es.json";
import en from "./en.json";

export const languages = {
  es: "Español",
  en: "English",
} as const;

export const defaultLang = "es" as const;

const dictionaries = { es, en } as const;

export type Lang = keyof typeof dictionaries;

export function useTranslations(lang: Lang) {
  const dict = dictionaries[lang];
  return (key: keyof typeof es) => dict[key] ?? dictionaries[defaultLang][key];
}

export const routes = {
  es: { home: "/", products: "/productos", contact: "/contacto" },
  en: { home: "/en", products: "/en/products", contact: "/en/contact" },
} as const;
