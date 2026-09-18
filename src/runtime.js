export const STATIC_SITE = import.meta.env?.MODE === "pages";
export const BASE_URL = import.meta.env?.BASE_URL || "/";
export const API_BASE = (import.meta.env?.VITE_API_URL || "").replace(
  /\/+$/,
  "",
);
export const CAN_IMPORT = !STATIC_SITE || !!API_BASE;
