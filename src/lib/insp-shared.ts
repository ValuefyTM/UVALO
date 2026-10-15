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

export const PROP_TYPES = ["Apartament", "Casă", "Teren", "Spațiu comercial / Hală", "Accesoriu (parcare, garaj, boxă)"];
export const CONTACT_ROLES = ["Proprietar", "Client", "Chiriaș", "Agent imobiliar", "Altă persoană"];
export const ASSIGN_LABEL = { me: "Eu", office: "Un coleg din birou", collab: "Un coleg din Colaborări" } as const;
export type AssignKind = keyof typeof ASSIGN_LABEL;

/** Inspection list row (the list, map and calendar views). */
export type InspRow = {
  id: string; code: string; status: Status; address: string; prop_type: string | null; cad_nr: string | null; lat: number | null; lng: number | null;
  contact_name: string | null; scheduled_at: string | null; duration_min: number; created_by: string; owner_name: string; assignee_id: string | null;
  assignee_name: string | null; assignee_kind: AssignKind; finished_at: string | null; photos: number; test: number;
};

/* ---------- the UVALO sheets: the same structure as the VALUEFY inspection form (v2, October 2026) ---------- */

type QOpt = Partial<Question>;
const q = (id: string, t: string, kind: QKind, options?: string[], more: QOpt = {}): Question => ({ id, t, kind, ...(options ? { options } : {}), req: false, pdf: true, ...more });
const one = (id: string, t: string, options: string[], more?: QOpt) => q(id, t, "one", options, more);
const many = (id: string, t: string, options: string[], more?: QOpt) => q(id, t, "many", options, more);
const num = (id: string, t: string, unit?: string, more?: QOpt) => q(id, t, "number", undefined, { ...(unit ? { unit } : {}), ...more });
const txt = (id: string, t: string, more?: QOpt) => q(id, t, "text", undefined, more);

const STARE = ["Foarte bună", "Bună", "Satisfăcătoare", "Deteriorată"];
const FINISAJ = ["Superioare", "Medii-superioare", "Medii", "Medii-inferioare", "Inferioare"];
const DA_NU = ["Da", "Nu"];
const VECINATATI = ["Deosebit de favorabile", "Civilizate", "Aspect dezolant"];
const FINISAJ_EXT = ["Termosistem", "Tencuială decorativă", "Placaj", "Tencuială simplă", "Neterminat"];
const USA_EXT = ["Metalică / antiefracție", "PVC", "Lemn", "Aluminiu"];
const USI_INT = ["MDF / celular", "Lemn masiv", "PVC", "Sticlă"];
const TAMPLARIE = ["PVC cu termopan", "Aluminiu cu termopan", "Lemn stratificat", "Lemn simplu"];
const DRUM = ["Asfalt", "Pavat", "Pietruit", "De pământ"];

/** Utility connections: connected (with the meter) or not, and the distance to the network when not connected. */
const util = (id: string, t: string, meter?: string): Question[] => [
  one(id, t, meter ? [`Branșat · ${meter}`, "Branșat · fără contor", "Nebranșat"] : ["Branșat", "Nebranșat"]),
  num(`${id}_distance_m`, `${t} · distanța până la rețea (dacă nu e branșat)`, "ml"),
];
const UTILS = (power = "Curent electric") => [...util("water", "Apă", "apometru montat"), ...util("sewer", "Canalizare"), ...util("gas", "Gaz", "contor montat"), ...util("power", power, "contor montat")];

/** First group of every sheet: where the property is (banks ask for position, zone type, transport and flood risk). */
const amplasament = (extra: Question[] = [], neighbours: Question = one("neighbourhood", "Vecinătăți", VECINATATI)): Group => ({ id: "amplasament", name: "Amplasament și zonă", qs: [
  one("locality_position", "Poziția în localitate", ["Central", "Semicentral", "Median", "Periferic", "Izolat / extravilan"]),
  one("zone_type", "Tipul zonei", ["Rezidențial", "Mixt rezidențial-comercial", "Comercial", "Industrial", "Agricol"]),
  neighbours,
  ...extra,
  many("public_transport", "Transport public în zonă", ["Autobuz", "Troleibuz", "Tramvai", "Metrou", "Maxi-taxi", "Tren", "Nu există"]),
  num("transport_distance_m", "Distanța până la stația de transport public", "m"),
  one("flood_risk", "Risc de inundație vizibil", ["Fără risc vizibil", "Aproape de râu / canal, cu dig", "Aproape de râu / canal, fără dig", "Urme de băltire / inundații"]),
  num("water_body_distance_m", "Distanța până la cel mai apropiat râu / canal", "m"),
] });

const RESIDENTIAL_EXTRA = [
  many("telecom", "Telecomunicații", ["Internet / cablu", "Telefon fix", "Nu există"]),
  many("renewables", "Surse regenerabile", ["Panouri fotovoltaice", "Panouri solare apă caldă", "Pompă de căldură", "Nu există"]),
  num("thermal_renovation_year", "Anul renovării termice (dacă e cazul)"),
];

/** Last group of every sheet: what the inspector found compared with the documents. */
const constatari = (occupancy = true): Group => ({ id: "constatari", name: "Constatări", qs: [
  one("inspection_scope", "Tipul inspecției", ["Interior și exterior", "Doar exterior"]),
  ...(occupancy ? [one("occupancy", "Utilizarea la data inspecției", ["Locuit de proprietar", "Închiriat", "Nelocuit", "În construcție"])] : []),
  one("completed", "Construcție finalizată", DA_NU),
  num("completion_pct", "Grad de finalizare (dacă nu e finalizată)", "%"),
  many("doc_differences", "Diferențe față de acte", ["Nu există", "Construcții / anexe neintabulate", "Extindere sau supraetajare", "Compartimentare modificată", "Mansardă / pod amenajat", "Suprafață diferită de acte", "Altă destinație decât în acte"]),
  txt("doc_differences_notes", "Detalii diferențe"),
  many("defects", "Defecte vizibile", ["Nu sunt", "Infiltrații", "Igrasie / umezeală", "Mucegai", "Fisuri", "Tencuieli căzute", "Instalații degradate", "Azbest (învelitoare / plăci)"]),
  txt("notes", "Observații"),
] });

const APARTAMENT: Group[] = [
  amplasament([one("access_road", "Drum de acces", DRUM), one("parking", "Parcare", ["Loc propriu", "Stradă", "Garaj", "Lipsă"])]),
  { id: "cladire", name: "Clădirea", qs: [
    one("building_kind", "Tipul clădirii", ["Bloc de locuințe", "Casă / duplex", "Vilă"]),
    num("year_built", "An construcție"),
    txt("height_regime", "Regim de înălțime"),
    txt("floor", "Etaj"),
    one("structure", "Structură", ["Panouri mari prefabricate", "Cadre beton armat", "Zidărie portantă", "Metalică"]),
    one("foundation", "Fundație", ["Fundații continue de beton", "Radier general", "Fundații izolate", "Nu se cunoaște"]),
    one("walls", "Închideri", ["Cărămidă", "BCA", "Cărămidă și BCA", "Panouri prefabricate", "Bolțari"]),
    one("roof", "Acoperiș", ["Terasă", "Șarpantă de lemn", "Șarpantă metalică"]),
    one("roof_cover", "Învelitoare", ["Țiglă", "Tablă", "Bitum / membrană", "Azbociment"]),
    one("elevator", "Lift", DA_NU),
    one("thermal_insulation", "Clădire anvelopată termic", ["Da", "Parțial", "Nu"]),
    one("seismic_class", "Risc seismic (plăcuța clădirii)", ["Fără încadrare / neexpertizat", "Bulină roșie / clasa I", "Clasa II", "Clasa III", "Clasa IV"]),
    many("common_areas", "Spații comune", ["Hol / casa scării", "Lift", "Curte comună", "Loc de parcare", "Boxă", "Terasă comună", "Nu există"]),
    one("building_condition", "Starea clădirii", STARE),
  ] },
  { id: "apartament", name: "Apartamentul", qs: [
    num("rooms", "Număr camere"),
    num("usable_area", "Suprafață utilă măsurată", "m²"),
    num("bathrooms", "Băi"),
    one("layout", "Compartimentare", ["Decomandat", "Semidecomandat", "Nedecomandat", "Circular"]),
    one("balconies", "Balcon / logie / terasă", ["Nu", "1", "2", "3+", "Închis"]),
    num("balcony_area", "Suprafață balcoane / terase", "m²"),
    num("ceiling_height_m", "Înălțimea interioară", "m"),
    many("orientation", "Orientare", ["N", "S", "E", "V"]),
  ] },
  { id: "finisaje", name: "Finisaje", qs: [
    one("finish_level", "Nivelul finisajelor", FINISAJ),
    many("floors_rooms", "Pardoseli camere", ["Parchet", "Laminat", "Gresie", "Mozaic", "Dușumea lemn"]),
    many("floors_wet", "Pardoseli zone umede", ["Gresie", "Mozaic", "Ciment"]),
    many("wall_finish", "Pereți", ["Vopsea lavabilă", "Tapet", "Faianță", "Tencuieli simple"]),
    one("windows", "Tâmplărie exterioară", TAMPLARIE),
    one("entrance_door", "Ușa de intrare", USA_EXT),
    one("interior_doors", "Tâmplărie interioară", USI_INT),
    num("last_renovation", "Anul ultimei renovări"),
  ] },
  { id: "instalatii", name: "Instalații și branșamente", qs: [
    one("heating", "Încălzire", ["Centrală proprie pe gaz", "Termoficare", "Centrală de bloc", "Sobe", "Electric", "Pompă de căldură", "Fără sistem de încălzire"]),
    ...UTILS(),
    many("own_sources", "Surse proprii (apartament în casă)", ["Puț", "Fosă septică", "Rezervor GPL", "Nu există"]),
    ...RESIDENTIAL_EXTRA,
    one("installations_condition", "Starea instalațiilor", STARE),
    one("air_conditioning", "Climatizare", DA_NU),
  ] },
  constatari(),
];

const CASA: Group[] = [
  amplasament(),
  { id: "teren", name: "Terenul", qs: [
    num("land_area", "Suprafață teren", "m²"),
    num("frontage_m", "Front stradal", "m"),
    one("shape", "Formă", ["Regulată", "Neregulată"]),
    one("slope", "Planeitate", ["Plan", "Ușor înclinat", "Înclinat"]),
    many("fencing", "Împrejmuire", ["Gard beton", "Gard metalic", "Gard lemn", "Plasă", "Lipsă"]),
    one("access_road", "Drum de acces", DRUM),
  ] },
  { id: "constructie", name: "Construcția principală", qs: [
    txt("height_regime", "Regim de înălțime"),
    num("year_built", "An construcție"),
    num("last_renovation", "Anul modernizării / renovării majore"),
    num("rooms", "Număr camere"),
    num("bathrooms", "Băi"),
    num("usable_area", "Suprafață utilă măsurată", "m²"),
    num("built_area", "Suprafață construită la sol", "m²"),
    num("balcony_area", "Suprafață terase / balcoane", "m²"),
    num("ceiling_height_m", "Înălțimea interioară", "m"),
    one("foundation", "Fundație", ["Fundații continue de beton", "Radier general", "Fundații izolate", "Fără fundație"]),
    one("structure", "Structură", ["Zidărie portantă cu centuri", "Cadre beton armat", "Lemn", "Metalică", "Chirpici / paiantă"]),
    one("walls", "Închideri", ["Cărămidă", "BCA", "Cărămidă și BCA", "Bolțari", "Lemn"]),
    one("roof", "Acoperiș", ["Șarpantă de lemn", "Șarpantă metalică", "Terasă"]),
    one("roof_cover", "Învelitoare", ["Țiglă", "Tablă", "Bitum", "Azbociment"]),
    one("building_condition", "Starea construcției", STARE),
  ] },
  { id: "finisaje", name: "Finisaje", qs: [
    one("finish_level", "Nivelul finisajelor", FINISAJ),
    one("exterior_finish", "Finisaj exterior", FINISAJ_EXT),
    many("floors_rooms", "Pardoseli camere", ["Parchet", "Gresie", "Laminat", "Marmură", "Dușumea lemn", "Ciment"]),
    many("floors_wet", "Pardoseli zone umede", ["Gresie", "Mozaic", "Ciment"]),
    many("wall_finish", "Pereți", ["Vopsea lavabilă", "Tapet", "Faianță", "Tencuieli simple"]),
    one("windows", "Tâmplărie exterioară", TAMPLARIE),
    one("entrance_door", "Ușa de intrare", USA_EXT),
    one("interior_doors", "Tâmplărie interioară", USI_INT),
  ] },
  { id: "instalatii", name: "Instalații și branșamente", qs: [
    one("heating", "Încălzire", ["Centrală pe gaz", "Pompă de căldură", "Combustibil solid", "Sobe", "Electric", "Fără sistem de încălzire"]),
    ...UTILS(),
    many("own_sources", "Surse proprii", ["Puț", "Fosă septică", "Rezervor GPL", "Generator", "Nu există"]),
    ...RESIDENTIAL_EXTRA,
    one("installations_condition", "Starea instalațiilor", STARE),
  ] },
  { id: "anexe", name: "Anexe", qs: [many("annexes", "Anexe pe teren", ["Garaj", "Magazie", "Foișor", "Piscină", "Nu există"])] },
  constatari(),
];

const TEREN: Group[] = [
  amplasament([one("access_road", "Drum de acces", ["Asfalt", "Pietruit", "De pământ", "Fără acces direct"])],
    many("surroundings", "Vecinătăți", ["Rezidențial", "Agricol", "Industrial", "Comercial"])),
  { id: "incadrare", name: "Încadrare", qs: [
    num("land_area", "Suprafață măsurată", "m²"),
    one("urban_zone", "Încadrare", ["Intravilan", "Extravilan"]),
    one("land_use", "Categorie de folosință", ["Curți-construcții", "Arabil", "Pășune", "Livadă", "Vie", "Pădure"]),
    many("urban_docs", "Documente de urbanism", ["PUG", "PUZ aprobat", "Certificat de urbanism", "Nu se cunosc"]),
  ] },
  { id: "configuratie", name: "Configurație", qs: [
    one("shape", "Formă", ["Regulată", "Neregulată"]),
    num("frontage_m", "Front stradal", "m"),
    num("street_fronts", "Număr de deschideri la stradă"),
    num("depth_m", "Adâncime", "m"),
    one("slope", "Planeitate", ["Plan", "Ușor înclinat", "Înclinat"]),
    many("fencing", "Împrejmuire", ["Gard", "Parțială", "Lipsă"]),
    many("land_improvements", "Îmbunătățiri", ["Pavaje / alei", "Platforme betonate", "Drenaje", "Nu există"]),
    many("easements", "Rețele care traversează terenul", ["Linie electrică aeriană", "Conducte / rețele subterane", "Drum de servitute", "Nu există vizibile"]),
  ] },
  { id: "bransamente", name: "Branșamente", qs: UTILS() },
  { id: "constructii", name: "Construcții pe teren", qs: [one("land_constructions", "Construcții pe teren", ["Nu există", "Provizorii", "De demolat", "În construcție"])] },
  { id: "constatari", name: "Constatări", qs: [
    one("inspection_scope", "Tipul inspecției", ["La fața locului", "Doar de la limita terenului"]),
    many("doc_differences", "Diferențe față de acte", ["Nu există", "Construcții neintabulate", "Suprafață / limite diferite de acte", "Altă folosință decât în acte"]),
    txt("doc_differences_notes", "Detalii diferențe"),
    txt("notes", "Observații"),
  ] },
];

const COMERCIAL: Group[] = [
  amplasament([
    one("road_access", "Acces rutier", ["Drum național", "Drum județean", "Stradă", "Drum de exploatare"]),
    one("visibility", "Vizibilitate de la drum", ["Ridicată", "Medie", "Redusă"]),
    num("yard_area", "Curte / parcare", "m²"),
  ]),
  { id: "spatiu", name: "Spațiul", qs: [
    one("use_type", "Destinație", ["Comercial stradal", "Birouri", "Hală de producție", "Depozit / logistică", "Turism / cazare"]),
    num("built_area", "Suprafață construită", "m²"),
    num("usable_area", "Suprafață utilă", "m²"),
    num("clear_height_m", "Înălțime liberă", "m"),
    txt("height_regime", "Regim de înălțime"),
    num("year_built", "An construcție"),
    one("occupancy", "Utilizare curentă", ["Ocupat de proprietar", "Închiriat", "Liber"]),
  ] },
  { id: "constructie", name: "Construcția", qs: [
    one("structure", "Structură", ["Metalică", "Beton armat prefabricat", "Cadre beton armat", "Zidărie"]),
    one("walls", "Închideri", ["Panouri sandwich", "Zidărie", "Tablă cutată", "Pereți cortină"]),
    one("roof", "Acoperiș", ["Panouri sandwich", "Tablă", "Terasă"]),
    one("floor_type", "Pardoseală", ["Beton elicopterizat", "Rășină epoxidică", "Gresie", "Mochetă / PVC"]),
    many("logistics", "Uși, rampe, echipamente", ["Uși secționale", "Rampe de încărcare", "Acces TIR", "Pod rulant"]),
    one("building_condition", "Starea construcției", STARE),
  ] },
  { id: "instalatii", name: "Instalații și branșamente", qs: [
    one("heating", "Încălzire", ["Aeroterme pe gaz", "Centrală termică", "Pompă de căldură", "Termoficare", "Fără"]),
    ...UTILS("Curent electric (trifazic)"),
    num("power_kw", "Putere electrică", "kW"),
    many("renewables", "Surse regenerabile", ["Panouri fotovoltaice", "Pompă de căldură", "Nu există"]),
    many("fire_safety", "Siguranță la incendiu", ["Hidranți", "Sprinklere", "Detecție incendiu", "Avizat ISU"]),
  ] },
  { id: "birouri", name: "Birouri și anexe", qs: [
    num("offices_area", "Birouri incluse", "m²"),
    one("offices_finish", "Finisaje birouri", ["Superioare", "Medii", "Inferioare", "Nu există"]),
    one("sanitary", "Grupuri sanitare / vestiare", DA_NU),
  ] },
  constatari(false),
];

const ACCESORIU: Group[] = [
  { id: "accesoriu", name: "Accesoriul", qs: [
    one("acc_kind", "Tip", ["Loc de parcare subteran", "Loc de parcare suprateran", "Garaj", "Boxă / debara"]),
    txt("acc_ident", "Număr / identificare"),
    txt("acc_level", "Nivel"),
    num("acc_area", "Suprafață măsurată", "m²"),
    one("acc_cover", "Acoperire", ["Închis", "Acoperit, deschis", "Descoperit"]),
    many("acc_access", "Acces", ["Rampă auto", "Lift auto", "Lift", "Scări", "Direct din curte / stradă", "Telecomandă / barieră"]),
    one("acc_condition", "Stare", STARE),
  ] },
  { id: "obs", name: "Observații", qs: [txt("notes", "Observații")] },
];

/** The UVALO templates (read-only; a person or a firm duplicates one to change it). */
export const UVALO_TEMPLATES: { key: string; name: string; prop: string; tpl: Template }[] = [
  { key: "apartament", name: "UVALO · Apartament", prop: "Apartament", tpl: { groups: APARTAMENT } },
  { key: "casa", name: "UVALO · Casă", prop: "Casă", tpl: { groups: CASA } },
  { key: "teren", name: "UVALO · Teren", prop: "Teren", tpl: { groups: TEREN } },
  { key: "comercial", name: "UVALO · Spațiu comercial / Hală", prop: "Spațiu comercial / Hală", tpl: { groups: COMERCIAL } },
  { key: "accesoriu", name: "UVALO · Accesoriu (parcare, garaj, boxă)", prop: "Accesoriu (parcare, garaj, boxă)", tpl: { groups: ACCESORIU } },
];

/** Rooms of the floor survey (releveu), described at the visit: the same lists as the VALUEFY sheet. */
export const ROOM_FIELDS = {
  floor: { label: "Pardoseală", opts: ["Parchet", "Laminat", "Gresie", "Mozaic", "Dușumea lemn", "Ciment", "Mochetă / PVC"] },
  walls: { label: "Pereți", opts: ["Vopsea lavabilă", "Faianță", "Tapet", "Tencuieli simple", "Lambriu", "Neterminat"] },
  ceiling: { label: "Plafon", opts: ["Vopsea lavabilă", "Gips-carton", "Tavan fals", "Lambriu", "Tencuială simplă"] },
  state: { label: "Stare", opts: STARE },
} as const;

/** Photo categories (the VALUEFY list), by the kind of property; the rooms are added between them. */
export function photoCategories(propType: string | null | undefined) {
  const t = (propType ?? "").toLowerCase();
  const land = t.startsWith("teren"), acc = t.startsWith("accesoriu"), home = /apartament|cas/.test(t) || !t;
  return {
    before: ["Exterior / fațadă", ...(land ? [] : ["Interior"]), ...(home ? ["Bucătărie", "Baie"] : [])],
    after: [...(acc ? [] : ["Accesorii (parcare, garaj, boxă)"]), "Instalații", "Contoare / branșamente", "Degradări", "Vecinătăți / acces", "Documente", "Altele"],
  };
}

/** Answers needed only in some cases (details, notes, completion %, distance to a network not connected) do not count towards completion. */
export const isOptional = (q: Question) => !q.req && (q.id === "notes" || q.id.endsWith("_notes") || q.id === "completion_pct" || /^(water|sewer|gas|power)_distance_m$/.test(q.id));

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
