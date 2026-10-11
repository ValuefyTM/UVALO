// UVALO pentru Chrome — the browser extension for capturing property listings as comparables (extensions/chrome).
// Downloaded from /chrome (public/chrome/uvalo-chrome.zip, made with `npm run chrome:zip`), installed with
// "Load unpacked"; it signs in with the UVALO session cookie and checks /api/chrome/status (module "chrome").

/** The extension's versions, newest first; the first must match "version" in extensions/chrome/manifest.json. */
export const CHROME_VERSIONS: { v: string; date: string; notes: string[] }[] = [
  { v: "2.0.0", date: "11 oct. 2026", notes: [
    "Extensia devine UVALO pentru Chrome: aspect UVALO, conectare cu contul UVALO, acces după abonament.",
    "Folosirea (capturi, exporturi) apare în statisticile UVALO; capturile rămân doar în Chrome.",
    "Panoul anunță când apare o versiune nouă.",
  ] },
  { v: "1.2.1", date: "iul. 2026", notes: [
    "Versiunea VALUEFY: capturi pe pagini A4, harta localizării, datele de contact, export Word și PDF.",
  ] },
];
export const CHROME_VERSION = CHROME_VERSIONS[0].v;
