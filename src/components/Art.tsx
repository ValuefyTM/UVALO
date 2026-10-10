// Illustrations of the home page tool cards (low bands over a dark plan) and of the upcoming modules (small icons).

/** The cadastral locator: a gold parcel on the plan, its corners, the label with its number and area (wide band;
 *  the middle stays in view when a narrow card crops the sides). */
export function LocatorBand() {
  return (
    <svg className="toolBand" viewBox="0 0 480 78" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Parcelă găsită pe planul cadastral">
      <rect width="480" height="78" fill="#161616" />
      <g stroke="#fff" strokeOpacity="0.12">
        <path d="M0 24 L480 -12 M0 54 L480 18 M0 84 L480 48 M30 0 L46 78 M90 0 L106 78 M150 0 L166 78 M210 0 L226 78 M270 0 L286 78 M330 0 L346 78 M390 0 L406 78 M450 0 L466 78" />
      </g>
      <path d="M0 74 L480 38" stroke="#fff" strokeOpacity="0.08" strokeWidth="12" />
      <path d="M196 22 L238 17 L244 52 L202 58 Z" fill="#f2a93b" fillOpacity="0.22" stroke="#f2a93b" strokeWidth="1.8" strokeLinejoin="round" />
      <g fill="#f2a93b"><circle cx="196" cy="22" r="3" /><circle cx="238" cy="17" r="3" /><circle cx="244" cy="52" r="3" /><circle cx="202" cy="58" r="3" /></g>
      <path d="M244 52 L266 46" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
      <rect x="266" y="36" width="84" height="20" rx="4" fill="#fff" />
      <text x="273" y="49.5" fontFamily="ui-monospace, Menlo, monospace" fontSize="9" fontWeight="700" fill="#141414">413830 · 890 mp</text>
    </svg>
  );
}

/** The comparables tool: the subject (house) linked to numbered comparables, with a distance (wide band). */
export function ComparablesBand() {
  const comps: [number, number][] = [[176, 20], [296, 18], [314, 60], [158, 60]];
  return (
    <svg className="toolBand" viewBox="0 0 480 78" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Proprietatea subiect și comparabilele pe hartă">
      <rect width="480" height="78" fill="#161616" />
      <g stroke="#fff" strokeOpacity="0.1"><path d="M0 30 L480 14 M0 64 L480 48 M100 0 L114 78 M200 0 L214 78 M300 0 L314 78 M400 0 L414 78" /></g>
      <ellipse cx="236" cy="40" rx="92" ry="30" fill="none" stroke="#f2a93b" strokeOpacity="0.35" strokeDasharray="3 4" />
      <g stroke="#f2a93b" strokeDasharray="3 4" strokeWidth="1.2">{comps.map(([x, y]) => <path key={x} d={`M236 40 L${x} ${y}`} />)}</g>
      <g fontFamily="Verdana, sans-serif" fontSize="7" fontWeight="700" fill="#141414" textAnchor="middle">
        {comps.map(([x, y], i) => <g key={x}><circle cx={x} cy={y} r="5.5" fill="#fff" /><text x={x} y={y + 2.5}>{i + 1}</text></g>)}
      </g>
      <circle cx="236" cy="40" r="8.5" fill="#f2a93b" />
      <path d="M232 41 L236 37 L240 41 V44.5 H232 Z" fill="#141414" />
      <rect x="250" y="22" width="34" height="13" rx="6.5" fill="rgba(255,255,255,0.14)" />
      <text x="267" y="31" fontFamily="ui-monospace, Menlo, monospace" fontSize="7.5" fill="#fff" textAnchor="middle">680 m</text>
    </svg>
  );
}

/** Upcoming: market analyses (bars and a trend line). */
export function MarketIcon() {
  return (
    <svg className="soonIcon" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="8" fill="#f1efe8" />
      <rect x="8" y="22" width="5" height="10" rx="1.5" fill="#b4b2a9" /><rect x="16" y="17" width="5" height="15" rx="1.5" fill="#b4b2a9" />
      <rect x="24" y="20" width="5" height="12" rx="1.5" fill="#b4b2a9" /><rect x="32" y="9" width="5" height="23" rx="1.5" fill="#ef9f27" />
      <path d="M9 18 L18 13 L26 16 L34 6" fill="none" stroke="#854f0b" strokeWidth="1.2" />
    </svg>
  );
}

/** Upcoming: collaborations (valuers linked). */
export function CollabIcon() {
  return (
    <svg className="soonIcon" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="8" fill="#f1efe8" />
      <path d="M11 12 L28 16 L19 29" fill="none" stroke="#b4b2a9" strokeDasharray="2 2" />
      <circle cx="11" cy="12" r="4" fill="#fff" stroke="#b4b2a9" />
      <circle cx="28" cy="16" r="5" fill="#2c2c2a" stroke="#ef9f27" strokeWidth="1.5" />
      <circle cx="19" cy="29" r="4.5" fill="#2c2c2a" stroke="#ef9f27" strokeWidth="1.5" />
    </svg>
  );
}
