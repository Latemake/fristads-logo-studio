import { translations } from "./translations.js";
import { productTranslations } from "./product-translations.js";
const STORAGE_KEY = "logo-studio-language";
export const LANGUAGES = ["en", "fi", "sv"];
let language = "en";
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (LANGUAGES.includes(stored)) language = stored;
} catch {
  /* Storage can be unavailable in private browsing. */
}
export const getLanguage = () => language;
const originals = new Map(
  Object.entries(translations).flatMap(([key, values]) =>
    Object.values(values).map((value) => [value, key]),
  ),
);
export function setLanguage(next) {
  if (!LANGUAGES.includes(next)) return;
  language = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* Still switch in memory. */
  }
  if (typeof document !== "undefined") document.documentElement.lang = next;
}
export function t(key, values = []) {
  key = originals.get(key) || key;
  const text = language === "fi" ? key : translations[key]?.[language] || key;
  return typeof text === "string"
    ? text.replace(/\{(\d+)\}/g, (_, i) => String(values[Number(i)] ?? ""))
    : text;
}
export function productText(text) {
  if (!text || language === "fi") return text;
  return (
    productTranslations[text]?.[language] ||
    text
      .split("/")
      .map((part) => productTranslations[part.trim()]?.[language] || part)
      .join("/")
  );
}
