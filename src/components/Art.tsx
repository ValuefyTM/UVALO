// Illustrations of the home page: the cadastral plan behind the locator's search, the small pictures of the tools and
// the pictures of the upcoming modules. Plain SVG in the UVALO colours (dark plan, gold parcel, red subject, teal points).

/** Behind the locator's search: a dark cadastral plan with one gold parcel on the right (decor). */
export function HeroArt() {
  return (
    <svg className="heroArt" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="#fff" strokeOpacity="0.08" fill="none">
        <path d="M0 80 L1000 30 M0 160 L1000 110 M0 240 L1000 190 M120 0 L150 300 M260 0 L290 300 M400 0 L430 300 M540 0 L570 300 M680 0 L710 300 M820 0 L850 300 M960 0 L990 300" />
      </g>
      <path d="M0 290 L1000 230" stroke="#fff" strokeOpacity="0.06" strokeWidth="22" />
      <path d="M748 92 L812 84 L820 146 L756 154 Z" fill="#f2a93b" fillOpacity="0.22" stroke="#f2a93b" strokeWidth="2.5" strokeLinejoin="round" />
      <g fill="#f2a93b"><circle cx="748" cy="92" r="4" /><circle cx="812" cy="84" r="4" /><circle cx="820" cy="146" r="4" /><circle cx="756" cy="154" r="4" /></g>
    </svg>
  );
}

/** Site analysis: the parcel inside its radius, with the numbered amenities around. */
export function SiteThumb() {
  const pois: [number, number][] = [[34, 20], [86, 16], [92, 60], [28, 60]];
  return (
    <svg className="toolThumb" viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" rx="12" fill="#161616" />
      <g stroke="#fff" strokeOpacity="0.1"><path d="M0 40 H120 M0 14 H120 M0 66 H120 M30 0 V80 M60 0 V80 M90 0 V80" /></g>
      <circle cx="60" cy="40" r="28" fill="none" stroke="#f2a93b" strokeOpacity="0.55" strokeDasharray="3 4" />
      <path d="M52 33 L68 31 L69 47 L53 49 Z" fill="#c23a2e" stroke="#fff" strokeWidth="1.2" />
      <g fontFamily="Verdana, sans-serif" fontSize="7" fontWeight="700" fill="#fff" textAnchor="middle">
        {pois.map(([x, y], i) => <g key={x}><circle cx={x} cy={y} r="6" fill="#1f6f63" /><text x={x} y={y + 2.5}>{i + 1}</text></g>)}
      </g>
    </svg>
  );
}

/** Comparables: the subject (house) linked to numbered comparables. */
export function CompsThumb() {
  const comps: [number, number][] = [[24, 18], [96, 16], [100, 62], [20, 62]];
  return (
    <svg className="toolThumb" viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" rx="12" fill="#161616" />
      <g stroke="#fff" strokeOpacity="0.1"><path d="M0 30 L120 18 M0 60 L120 48 M40 0 L46 80 M80 0 L86 80" /></g>
      <g stroke="#f2a93b" strokeDasharray="3 3" strokeWidth="1.2">{comps.map(([x, y]) => <path key={x} d={`M60 40 L${x} ${y}`} />)}</g>
      <g fontFamily="Verdana, sans-serif" fontSize="7" fontWeight="700" fill="#141414" textAnchor="middle">
        {comps.map(([x, y], i) => <g key={x}><circle cx={x} cy={y} r="6" fill="#fff" /><text x={x} y={y + 2.5}>{i + 1}</text></g>)}
      </g>
      <circle cx="60" cy="40" r="10" fill="#f2a93b" />
      <path d="M55 41.5 L60 36.5 L65 41.5 V45.5 H55 Z" fill="#141414" />
    </svg>
  );
}

/** Cadastral locator: parcels of a plan, one of them found (gold) with its pin. */
export function LocThumb() {
  return (
    <svg className="toolThumb" viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" rx="12" fill="#161616" />
      <g stroke="#fff" strokeOpacity="0.16" fill="none"><path d="M10 22 L46 18 L48 40 L12 44 Z M48 18 L80 15 L82 37 L50 40 Z M82 15 L110 12 L112 34 L84 37 Z M12 46 L48 42 L50 66 L14 70 Z M84 39 L112 36 L114 60 L86 63 Z" /></g>
      <path d="M50 42 L84 39 L86 63 L52 66 Z" fill="#f2a93b" fillOpacity="0.28" stroke="#f2a93b" strokeWidth="1.6" />
      <path d="M68 22 c-5 0 -8 4 -8 8 c0 6 8 14 8 14 s8 -8 8 -14 c0 -4 -3 -8 -8 -8 Z" fill="#f2a93b" />
      <circle cx="68" cy="30" r="3" fill="#161616" />
    </svg>
  );
}

/** UVALO for Word: a report page with a photo grid and the gold UVALO tab. */
export function WordThumb() {
  return (
    <svg className="toolThumb" viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" rx="12" fill="#161616" />
      <rect x="30" y="10" width="60" height="64" rx="3" fill="#fff" />
      <rect x="36" y="16" width="24" height="7" rx="2" fill="#f2a93b" />
      <g fill="#cfc6b3"><rect x="36" y="27" width="22" height="16" rx="1.5" /><rect x="62" y="27" width="22" height="16" rx="1.5" /><rect x="36" y="47" width="22" height="16" rx="1.5" /><rect x="62" y="47" width="22" height="16" rx="1.5" /></g>
      <g fill="#8aa1b5"><rect x="36" y="35" width="22" height="8" rx="1.5" /><rect x="62" y="35" width="22" height="8" rx="1.5" /></g>
      <rect x="94" y="56" width="18" height="16" rx="3" fill="#f2a93b" />
      <text x="103" y="67.5" fontFamily="Verdana, sans-serif" fontSize="9" fontWeight="700" fill="#141414" textAnchor="middle">W</text>
    </svg>
  );
}

/** UVALO for Chrome: a listing page cut into A4 slices, sent on to the report. */
export function ChromeThumb() {
  return (
    <svg className="toolThumb" viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" rx="12" fill="#161616" />
      <rect x="12" y="10" width="46" height="62" rx="3" fill="#fff" />
      <rect x="12" y="10" width="46" height="7" rx="3" fill="#cfc6b3" />
      <rect x="16" y="21" width="38" height="18" rx="1.5" fill="#8aa1b5" />
      <g fill="#cfc6b3"><rect x="16" y="43" width="30" height="3" /><rect x="16" y="49" width="38" height="3" /><rect x="16" y="55" width="34" height="3" /></g>
      <path d="M8 40 H62" stroke="#f2a93b" strokeWidth="1.4" strokeDasharray="3 3" />
      <path d="M68 41 H86 M80 35 L86 41 L80 47" stroke="#f2a93b" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="90" y="22" width="20" height="38" rx="2" fill="#fff" />
      <rect x="93" y="26" width="14" height="10" rx="1" fill="#8aa1b5" />
      <g fill="#cfc6b3"><rect x="93" y="40" width="14" height="2" /><rect x="93" y="45" width="14" height="2" /><rect x="93" y="50" width="10" height="2" /></g>
    </svg>
  );
}

/** Upcoming market analyses: a district map with prices per square metre and the price trend beside it. */
export function MarketArt() {
  const tags: [number, number, string][] = [[92, 62, "1.450"], [176, 104, "1.620"], [70, 136, "1.380"]];
  return (
    <svg className="soonArt" viewBox="0 0 480 190" role="img" aria-label="Prețuri pe metru pătrat pe hartă și evoluția lor">
      <rect width="480" height="190" fill="#f3eee3" />
      <g stroke="#fff" strokeWidth="9" strokeLinecap="round"><path d="M0 92 L250 70 M120 0 L140 190 M0 170 L250 150" /></g>
      <g fill="#e6dccb"><rect x="22" y="18" width="80" height="44" rx="6" /><rect x="152" y="14" width="80" height="46" rx="6" /><rect x="20" y="104" width="94" height="52" rx="6" /><rect x="154" y="82" width="78" height="56" rx="6" /></g>
      <g fontFamily="Verdana, sans-serif" fontSize="11" fontWeight="700" textAnchor="middle">
        {tags.map(([x, y, t]) => (
          <g key={t}>
            <rect x={x - 34} y={y - 15} width="68" height="22" rx="11" fill="#141414" />
            <text x={x} y={y} fill="#fff">{t} €</text>
            <path d={`M${x - 5} ${y + 7} L${x} ${y + 13} L${x + 5} ${y + 7} Z`} fill="#141414" />
          </g>
        ))}
      </g>
      <rect x="268" y="18" width="192" height="154" rx="14" fill="#fff" />
      <g fill="#d8cfbd"><rect x="290" y="112" width="18" height="40" rx="3" /><rect x="318" y="98" width="18" height="54" rx="3" /><rect x="346" y="104" width="18" height="48" rx="3" /><rect x="374" y="84" width="18" height="68" rx="3" /></g>
      <rect x="402" y="62" width="18" height="90" rx="3" fill="#f2a93b" />
      <path d="M290 92 L326 80 L356 86 L384 62 L430 40" fill="none" stroke="#c23a2e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="430" cy="40" r="5" fill="#c23a2e" />
      <text x="288" y="40" fontFamily="Verdana, sans-serif" fontSize="11" fontWeight="700" fill="#141414">€/mp</text>
    </svg>
  );
}

/** Upcoming collaborations: an inspection (house, checklist) handed from one valuer to another. */
export function CollabArt() {
  return (
    <svg className="soonArt" viewBox="0 0 480 190" role="img" aria-label="Doi evaluatori care colaborează la o inspecție">
      <rect width="480" height="190" fill="#f3eee3" />
      <path d="M0 160 H480" stroke="#e6dccb" strokeWidth="2" />
      {/* the house being inspected, with the checklist */}
      <path d="M190 160 V96 L240 58 L290 96 V160 Z" fill="#fff" stroke="#141414" strokeWidth="3" strokeLinejoin="round" />
      <rect x="226" y="122" width="28" height="38" fill="#f2a93b" />
      <rect x="202" y="104" width="18" height="16" fill="#e6dccb" /><rect x="260" y="104" width="18" height="16" fill="#e6dccb" />
      <g transform="translate(300 74)">
        <rect width="64" height="80" rx="8" fill="#fff" stroke="#141414" strokeWidth="2.5" />
        <rect x="20" y="-6" width="24" height="12" rx="4" fill="#141414" />
        <g stroke="#1f6f63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"><path d="M12 24 l5 5 9-10" /><path d="M12 46 l5 5 9-10" /></g>
        <g stroke="#d8cfbd" strokeWidth="4" strokeLinecap="round"><path d="M34 26 H52" /><path d="M34 48 H52" /><path d="M14 66 H50" /></g>
      </g>
      {/* two valuers, linked */}
      <g>
        <circle cx="86" cy="76" r="18" fill="#141414" />
        <path d="M54 150 C54 118 118 118 118 150 Z" fill="#141414" />
        <circle cx="404" cy="76" r="18" fill="#f2a93b" />
        <path d="M372 150 C372 118 436 118 436 150 Z" fill="#f2a93b" />
      </g>
      <path d="M124 92 C150 60 168 60 184 74" fill="none" stroke="#c23a2e" strokeWidth="2.5" strokeDasharray="5 5" />
      <path d="M386 98 C372 120 372 130 368 136" fill="none" stroke="#c23a2e" strokeWidth="2.5" strokeDasharray="5 5" />
      <g transform="translate(104 24)">
        <rect width="78" height="26" rx="13" fill="#fff" stroke="#e2d8c4" />
        <text x="39" y="17" fontFamily="Verdana, sans-serif" fontSize="10.5" fontWeight="700" fill="#141414" textAnchor="middle">Inspecție</text>
      </g>
      <g transform="translate(376 24)">
        <rect width="70" height="26" rx="13" fill="#fff" stroke="#e2d8c4" />
        <text x="35" y="17" fontFamily="Verdana, sans-serif" fontSize="10.5" fontWeight="700" fill="#141414" textAnchor="middle">Angajare</text>
      </g>
    </svg>
  );
}
