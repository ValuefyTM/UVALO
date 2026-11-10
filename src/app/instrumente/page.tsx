import type { Metadata } from "next";
import { page } from "@/lib/guard";
import { AppShell } from "@/components/AppShell";
import { ChromeThumb, CompsThumb, LocThumb, SiteThumb, WordThumb } from "@/components/Art";

export const metadata: Metadata = { title: "Instrumente | UVALO" };
export const dynamic = "force-dynamic";

const GROUPS = [
  { title: "Pe platformă", tools: [
    { key: "localizare", href: "/localizare", name: "Localizator cadastral", desc: "Orice imobil din planurile ANCPI: număr cadastral, topo, adresă sau poziția ta pe teren. Coordonate Stereo 70, vecini, construcții, fișă PDF.", Thumb: LocThumb, main: true },
    { key: "amplasament", href: "/amplasament", name: "Analiza amplasamentului", desc: "Fișa zonei și textul pentru raport, din planul cadastral și OpenStreetMap.", Thumb: SiteThumb },
    { key: "comparabile", href: "/comparabile", name: "Localizator de comparabile", desc: "Subiectul și comparabilele pe hartă, cu distanțe, gata de raport.", Thumb: CompsThumb },
  ] },
  { title: "În Word și în browser", tools: [
    { key: "word", href: "/word", name: "UVALO pentru Word", desc: "Anexa foto, anexa cu documente și comparabilele, direct în raportul Word, dintr-un tab UVALO.", Thumb: WordThumb },
    { key: "chrome", href: "/chrome", name: "UVALO pentru Chrome", desc: "Anunțurile comparabilelor, capturate complet pe pagini A4 și trimise în Word.", Thumb: ChromeThumb },
  ] },
];

/** All the tools of UVALO in one page (the menu keeps only Acasă, Instrumente and În curând). */
export default async function Instrumente() {
  const { c } = await page();
  return (
    <AppShell c={c} active="instrumente" title="Instrumente" subtitle="Tot ce poți folosi în UVALO, pe platformă și în aplicațiile tale">
      {GROUPS.map((g) => {
        const tools = g.tools.filter((t) => c.super || !c.off.includes(t.key));
        if (!tools.length) return null;
        return (
          <section key={g.title} aria-label={g.title}>
            <h2 className="homeSec">{g.title}</h2>
            <div className="instGrid">
              {tools.map(({ key, href, name, desc, Thumb, ...t }) => {
                const on = c.modules.includes(key);
                const body = (
                  <>
                    <Thumb />
                    <span className="toolText"><b>{name}</b><span>{on ? desc : c.off.includes(key) ? "Dezactivat temporar" : "Nu e inclus în abonament"}</span></span>
                    {on && <span className="toolGo" aria-hidden="true">→</span>}
                  </>
                );
                const cls = `toolTile instTile${"main" in t && t.main ? " instMain" : ""}`;
                return on ? <a key={key} className={cls} href={href}>{body}</a> : <div key={key} className={`${cls} off`}>{body}</div>;
              })}
            </div>
          </section>
        );
      })}
    </AppShell>
  );
}
