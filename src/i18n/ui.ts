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
  es: {
    home: "/",
    products: "/productos",
    wheels: "/productos/ruedas",
    contact: "/contacto",
  },
  en: {
    home: "/en",
    products: "/en/products",
    wheels: "/en/products/wheels",
    contact: "/en/contact",
  },
} as const;
