// Shared by the browser (Survey.tsx) and the server (survey.ts): the questionnaire's shape, tools, labels, default options.
export type SurveySettings = {
  id: string;            // a new id = everyone eligible gets the questionnaire again
  on: boolean;
  min_actions: number;   // eligible from this many rows in `events`
  stop_n: number;        // stop after this many completed answers (0 = never)
  stop_at: string;       // stop at this date (YYYY-MM-DD, "" = never)
  wants: string[];       // the options of step 3 ("Ce ți-ar fi cel mai util"), editable in admin
  started_at: string;
};

export const SURVEY_STEPS = 5;
/** The tools rated at step 2: key = the module in `events`. */
export const SURVEY_TOOLS: { key: string; label: string }[] = [
  { key: "localizare", label: "Localizator cadastral" },
  { key: "amplasament", label: "Analiză amplasament" },
  { key: "comparabile", label: "Localizator Comparabile" },
  { key: "word", label: "UVALO pentru Word" },
  { key: "chrome", label: "UVALO pentru Chrome" },
  { key: "inspectii", label: "Inspecții pe telefon" },
  { key: "colaborari", label: "Colaborări" },
];
export const DEFAULT_WANTS = [
  "Analize de piață · statistici și prețuri din tranzacții, pe zone",
  "Raport de evaluare generat din fișă · fișa de inspecție → schelet de raport Word",
  "Bibliotecă de fișe de inspecție · fișe gata făcute pe tipuri de imobil și bănci",
  "Inspecție cu mai multe bunuri la o adresă · apartament + parcare + boxă într-o vizită",
  "Planuri cadastrale în județul meu",
  "Integrare cu programul firmei / CRM · inspecțiile pleacă și se întorc automat",
  "Aplicație în App Store / Google Play · în locul instalării din browser",
  "Mai multe comparabile și surse de anunțuri",
];
export const SURVEY_LABELS = {
  problems: { none: "Nu", rare: "Da, rar", often: "Da, des", quit: "M-au făcut să renunț la un instrument" },
  freq: { daily: "Zilnic", often: "De câteva ori pe săptămână", weekly: "Săptămânal", rare: "Mai rar" },
  device: { pc: "Calculator", phone: "Telefon", both: "Amândouă" },
  back: { time: "Scutește drumuri / timp", maps: "Hărțile cadastrale", sheets: "Fișele de inspecție", colleagues: "Colegii / biroul", other: "Altceva" },
  price: { none: "Nimic, doar gratuit", lt10: "Sub 10 €", p10_20: "10 – 20 €", p20_40: "20 – 40 €", gt40: "Peste 40 €" },
  model: { user: "Abonament pe evaluator", office: "Abonament pe birou", credits: "Pe credite" },
  extra: { analize: "Analize de piață", ai: "Citirea actelor cu AI", inspectii: "Inspecții pe telefon", word: "Word + Chrome", none: "Nimic separat" },
} as const;

export type SurveyState = {
  id: string; step: number; answers: Record<string, unknown>; wants: string[]; name: string; phone: string;
  // what the person has used (for step 2: the tools they have not used are marked "Nu l-am folosit", the counts are shown)
  tools: { key: string; label: string; n: number; last: string | null }[];
};

