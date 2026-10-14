// Inspecții: types, statuses and the UVALO default templates, shared by the pages (browser) and the server.

export type QKind = "one" | "many" | "text" | "number" | "date";
export type Question = { id: string; t: string; kind: QKind; options?: string[]; def?: string; unit?: string; req?: boolean; pdf?: boolean; photo?: boolean };
export type Group = { id: string; name: string; qs: Question[] };
export type Template = { groups: Group[] };

export const QKIND_LABEL: Record<QKind, string> = { one: "Alegere unică", many: "Alegere multiplă", text: "Text", number: "Număr", date: "Dată" };

export type Status = "prog" | "plan" | "lucru" | "gata" | "pred";
export const STATUS: Record<Status, { label: string; fg: string; bg: string }> = {
  prog: { label: "De programat", fg: "#8A5A00", bg: "#FBEBD0" },
  plan: { label: "Programată", fg: "#1D3F6E", bg: "#E4ECF7" },
  lucru: { label: "În lucru", fg: "#7A3A12", bg: "#F6E3D5" },
  gata: { label: "Finalizată", fg: "#2F4A0E", bg: "#E3EFD3" },
  pred: { label: "Predată", fg: "#4A423A", bg: "#EEE8DC" },
};
export const STATUSES = Object.keys(STATUS) as Status[];

export const PROP_TYPES = ["Casă cu teren", "Apartament", "Teren", "Spațiu comercial", "Birouri", "Spațiu industrial"];
export const CONTACT_ROLES = ["Proprietar", "Chiriaș", "Agent imobiliar", "Reprezentant bancă", "Altă persoană"];
export const ASSIGN_LABEL = { me: "Eu", office: "Un coleg din birou", collab: "Un coleg din Colaborări" } as const;
export type AssignKind = keyof typeof ASSIGN_LABEL;

/** Inspection list row (the list, map and calendar views). */
export type InspRow = {
  id: string; code: string; status: Status; address: string; prop_type: string | null; cad_nr: string | null; lat: number | null; lng: number | null;
  contact_name: string | null; scheduled_at: string | null; duration_min: number; created_by: string; owner_name: string; assignee_id: string | null;
  assignee_name: string | null; assignee_kind: AssignKind; finished_at: string | null; photos: number; test: number;
};

let n = 0;
const q = (t: string, kind: QKind, options?: string[], more: Partial<Question> = {}): Question => ({ id: `q${++n}`, t, kind, ...(options ? { options } : {}), req: true, pdf: true, ...more });

const IDENT: Group = { id: "ident", name: "Identificare", qs: [
  q("Tipul inspecției", "one", ["Interior și exterior", "Doar exterior", "Desktop (fără vizită)"], { def: "Interior și exterior" }),
  q("Prezent la inspecție", "text"),
  q("Utilizare", "one", ["Locuită de proprietar", "Închiriată", "Liberă", "În construcție"]),
  q("Concordanță cu actele", "one", ["Da", "Parțial", "Nu"], { def: "Da" }),
] };
const ZONA: Group = { id: "zona", name: "Amplasament și zonă", qs: [
  q("Poziția în localitate", "one", ["Central", "Semicentral", "Median", "Periferic", "În afara localității"]),
  q("Tipul zonei", "one", ["Rezidențial", "Mixt", "Comercial", "Industrial", "Agricol"], { def: "Rezidențial" }),
  q("Vecinătăți", "one", ["Civilizate", "Cu efect negativ"], { def: "Civilizate" }),
  q("Drum de acces", "one", ["Asfalt", "Pietruit", "De pământ"]),
  q("Transport public", "text", undefined, { req: false }),
  q("Risc de inundație", "one", ["Fără risc vizibil", "Zonă cu risc"], { def: "Fără risc vizibil" }),
] };
const TEREN: Group = { id: "teren", name: "Terenul", qs: [
  q("Formă", "one", ["Regulată", "Neregulată"]),
  q("Deschidere la stradă", "number", undefined, { unit: "m" }),
  q("Topografie", "one", ["Plan", "În pantă ușoară", "În pantă accentuată"], { def: "Plan" }),
  q("Împrejmuire", "one", ["Completă", "Parțială", "Fără"]),
  q("Încadrare", "one", ["Intravilan", "Extravilan"], { def: "Intravilan" }),
] };
const CONSTR: Group = { id: "constr", name: "Construcția", qs: [
  q("An construcție", "number"),
  q("Regim de înălțime", "text"),
  q("Structura", "one", ["Zidărie portantă", "Cadre beton armat", "Panouri prefabricate", "Lemn", "Metalică"]),
  q("Acoperiș · învelitoare", "one", ["Șarpantă · țiglă", "Șarpantă · tablă", "Terasă"]),
  q("Tâmplărie", "one", ["PVC cu termopan", "Aluminiu", "Lemn stratificat", "Lemn simplu"]),
  q("Stare generală", "one", ["Foarte bună", "Bună", "Satisfăcătoare", "Necesită reparații"], { def: "Bună" }),
] };
const FINIS: Group = { id: "finis", name: "Finisaje și instalații", qs: [
  q("Nivel finisaje", "one", ["Superioare", "Medii-superioare", "Medii", "Inferioare"]),
  q("Încălzire", "one", ["Centrală proprie pe gaz", "Termoficare", "Pompă de căldură", "Sobe / fără"], { def: "Centrală proprie pe gaz" }),
  q("Climatizare", "text", undefined, { req: false }),
  q("Ultima renovare", "number", undefined, { req: false }),
] };
const UTIL: Group = { id: "util", name: "Utilități", qs: [
  q("Utilități branșate", "many", ["Apă", "Canalizare", "Gaz", "Curent electric"]),
] };
const BLOC: Group = { id: "bloc", name: "Clădirea", qs: [
  q("Etaj / număr de niveluri", "text"),
  q("An construcție bloc", "number"),
  q("Lift", "one", ["Da", "Nu"]),
  q("Starea părților comune", "one", ["Bună", "Satisfăcătoare", "Degradată"]),
] };

/** The UVALO templates (read-only; a person or a firm duplicates one to change it). */
export const UVALO_TEMPLATES: { key: string; name: string; prop: string; tpl: Template }[] = [
  { key: "casa", name: "UVALO · Casă cu teren", prop: "Casă cu teren", tpl: { groups: [IDENT, ZONA, TEREN, CONSTR, FINIS, UTIL] } },
  { key: "apartament", name: "UVALO · Apartament", prop: "Apartament", tpl: { groups: [IDENT, ZONA, BLOC, FINIS, UTIL] } },
  { key: "teren", name: "UVALO · Teren", prop: "Teren", tpl: { groups: [IDENT, ZONA, TEREN, UTIL] } },
];

export const qCount = (t: Template | null | undefined) => (t?.groups ?? []).reduce((s, g) => s + g.qs.length, 0);

/** A template read from storage, cleaned (unknown shapes are dropped, limits applied). */
export function cleanTemplate(v: unknown): Template {
  const g0 = (v && typeof v === "object" && Array.isArray((v as Template).groups) ? (v as Template).groups : []).slice(0, 30);
  const s = (x: unknown, m = 160) => (typeof x === "string" ? x.trim().slice(0, m) : "");
  return {
    groups: g0.map((g, gi) => ({
      id: s(g?.id, 40) || `g${gi + 1}`,
      name: s(g?.name, 80) || "Grup",
      qs: (Array.isArray(g?.qs) ? g.qs : []).slice(0, 60).map((x, qi) => {
        const kind: QKind = (["one", "many", "text", "number", "date"] as const).includes(x?.kind) ? x.kind : "text";
        const options = Array.isArray(x?.options) ? x.options.map((o: unknown) => s(o, 80)).filter(Boolean).slice(0, 30) : [];
        return {
          id: s(x?.id, 40) || `${g?.id ?? "g"}q${qi + 1}`, t: s(x?.t) || "Întrebare", kind,
          ...(kind === "one" || kind === "many" ? { options } : {}),
          ...(s(x?.def, 80) ? { def: s(x?.def, 80) } : {}), ...(s(x?.unit, 12) ? { unit: s(x?.unit, 12) } : {}),
          req: !!x?.req, pdf: x?.pdf !== false, photo: !!x?.photo,
        };
      }),
    })),
  };
}

/** "2026-10-16T10:00" → "16.10.2026, 10:00" */
export function fmtWhen(s: string | null | undefined) {
  if (!s) return "—";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  return m ? `${m[3]}.${m[2]}.${m[1]}${m[4] ? `, ${m[4]}:${m[5]}` : ""}` : s;
}
