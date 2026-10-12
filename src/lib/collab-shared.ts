// Colaborări: constants shared by the page (browser) and the server.

export const COUNTIES = ["Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani", "Brașov", "Brăila", "București", "Buzău", "Caraș-Severin",
  "Călărași", "Cluj", "Constanța", "Covasna", "Dâmbovița", "Dolj", "Galați", "Giurgiu", "Gorj", "Harghita", "Hunedoara", "Ialomița", "Iași", "Ilfov",
  "Maramureș", "Mehedinți", "Mureș", "Neamț", "Olt", "Prahova", "Satu Mare", "Sălaj", "Sibiu", "Suceava", "Teleorman", "Timiș", "Tulcea", "Vaslui",
  "Vâlcea", "Vrancea"];
export const KINDS = { inspectie: "Inspecție", raport: "Raport + inspecție" } as const;
export type Kind = keyof typeof KINDS;
export const PROPS = ["Apartament", "Casă", "Teren", "Comercial", "Birouri", "Industrial", "Bunuri mobile"];
export const POST_SPECS = ["EPI", "EI", "EBM", "EIF"];
export const YEARS = ["Sub 2 ani", "2–5 ani", "5–10 ani", "Peste 10 ani"];
export const SKILL_SUGGESTIONS = ["Inspecții rezidențiale", "Proprietăți comerciale", "Proprietăți industriale", "Terenuri agricole", "Abordarea prin venit",
  "Rapoarte pentru bănci", "Expertize pentru instanță", "Utilaje și echipamente", "Studii de piață", "Releveu / AutoCAD"];
export type CollabMode = "off" | "test" | "on";
export const MODE_LABEL: Record<CollabMode, string> = { off: "Dezactivat", test: "Test", on: "Activ" };

/** Distance on the road, estimated: straight line × 1.25 (km). */
export function km(a: { lat: number | null; lng: number | null }, b: { lat: number | null; lng: number | null }) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const r = (x: number) => (x * Math.PI) / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h)) * 1.25;
}
