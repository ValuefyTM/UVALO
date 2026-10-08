/** 2026-07-13 → 13.07.2026 (client-safe). */
export const roDate = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join(".") : "");
