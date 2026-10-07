/** Illustration of the cadastral locator card: plan lines over a dark map, the found parcel in gold, its corners, a pin. */
export function LocatorArt() {
  const lines = "rgba(255,255,255,0.28)";
  return (
    <svg className="toolArt" viewBox="0 0 320 150" role="img" aria-label="Parcelă găsită pe planul cadastral" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="laBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1c1c1c" /><stop offset="1" stopColor="#0b0b0b" /></linearGradient>
        <radialGradient id="laGlow" cx="0.55" cy="0.5" r="0.5"><stop offset="0" stopColor="#f2a93b" stopOpacity="0.28" /><stop offset="1" stopColor="#f2a93b" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="320" height="150" fill="url(#laBg)" />
      <rect width="320" height="150" fill="url(#laGlow)" />
      {/* street */}
      <path d="M-10 118 L330 38" stroke="rgba(255,255,255,0.10)" strokeWidth="16" />
      <path d="M-10 118 L330 38" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="6 7" />
      {/* parcels */}
      <g fill="none" stroke={lines} strokeWidth="1">
        <path d="M20 -5 L48 98 M62 -5 L92 88 M104 -5 L136 78 M198 -5 L226 57 M240 -5 L268 47 M282 -5 L310 37" />
        <path d="M60 135 L72 160 M110 124 L124 160 M160 112 L176 160 M210 100 L228 160 M262 88 L282 160" />
        <path d="M0 40 L320 -36 M0 70 L320 -6" />
        <path d="M30 148 L330 78" />
      </g>
      {/* buildings */}
      <g fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8">
        <path d="M70 34 L86 30 L91 48 L75 52 Z" /><path d="M250 12 L266 8 L270 24 L254 28 Z" /><path d="M128 132 L146 128 L150 144 L132 148 Z" />
      </g>
      {/* found parcel */}
      <path d="M138 30 L184 19 L204 68 L158 79 Z" fill="rgba(242,169,59,0.30)" stroke="#f2a93b" strokeWidth="2.4" strokeLinejoin="round" />
      <g fontFamily="ui-monospace, Menlo, monospace" fontSize="7" fontWeight="700" textAnchor="middle" fill="#111">
        {[[138, 30, 1], [184, 19, 2], [204, 68, 3], [158, 79, 4]].map(([x, y, n]) => (
          <g key={n}><circle cx={x} cy={y} r="6" fill="#f2a93b" stroke="#111" strokeWidth="1.2" /><text x={x} y={y + 2.5}>{n}</text></g>
        ))}
      </g>
      {/* pin */}
      <g transform="translate(171 49)">
        <ellipse cx="0" cy="2" rx="6" ry="2" fill="rgba(0,0,0,0.5)" />
        <path d="M0 0 C-9 -12 -10 -16 -10 -20 A10 10 0 0 1 10 -20 C10 -16 9 -12 0 0 Z" fill="#fff" />
        <circle cx="0" cy="-20" r="4" fill="#f2a93b" />
      </g>
      {/* label */}
      <g transform="translate(200 96)">
        <rect width="108" height="30" rx="9" fill="#fff" />
        <text x="10" y="13" fontFamily="Verdana, sans-serif" fontSize="7" fontWeight="700" fill="#9a5f00">NR. CADASTRAL</text>
        <text x="10" y="24" fontFamily="ui-monospace, Menlo, monospace" fontSize="9.5" fontWeight="700" fill="#111">413830 · 890 mp</text>
      </g>
      {/* north */}
      <g transform="translate(296 22)">
        <circle r="11" fill="rgba(255,255,255,0.92)" />
        <path d="M0 -7 L4 5 L0 2 L-4 5 Z" fill="#111" />
      </g>
    </svg>
  );
}

/** Illustration of the upcoming collaboration portal: valuers linked across the map. */
export function CollabArt() {
  const pts: [number, number][] = [[48, 42], [120, 92], [190, 38], [262, 96], [84, 120], [232, 30]];
  const links: [number, number][] = [[0, 1], [1, 2], [2, 3], [1, 4], [2, 5], [3, 5], [0, 2]];
  return (
    <svg className="toolArt" viewBox="0 0 320 150" role="img" aria-label="Evaluatori conectați" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="150" fill="#fbf3e2" />
      <g stroke="#e0c58f" strokeWidth="1.5" strokeDasharray="4 5">{links.map(([a, b]) => <line key={`${a}${b}`} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} />)}</g>
      {pts.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r={i === 1 || i === 2 ? 15 : 11} fill={i === 1 || i === 2 ? "#111" : "#fff"} stroke={i === 1 || i === 2 ? "#f2a93b" : "#e0c58f"} strokeWidth="2" />
          <circle cy={i === 1 || i === 2 ? -3 : -2} r={i === 1 || i === 2 ? 4 : 3} fill={i === 1 || i === 2 ? "#f2a93b" : "#c79a4a"} />
          <path d={i === 1 || i === 2 ? "M-7 8 C-6 3 6 3 7 8" : "M-5 6 C-4 2 4 2 5 6"} fill={i === 1 || i === 2 ? "#f2a93b" : "#c79a4a"} />
        </g>
      ))}
      <g transform="translate(140 56)">
        <rect x="-26" y="-11" width="52" height="20" rx="10" fill="#f2a93b" />
        <text y="3" textAnchor="middle" fontFamily="Verdana, sans-serif" fontSize="8" fontWeight="700" fill="#111">inspecție</text>
      </g>
    </svg>
  );
}

/** Illustration of the market analysis card: price trend over a zone map, comparables as price tags. */
export function MarketArt() {
  const trend: [number, number][] = [[18, 112], [58, 104], [98, 108], [138, 88], [178, 92], [218, 70], [258, 62], [302, 44]];
  const line = trend.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const bars = [52, 66, 58, 80, 74, 92, 100, 118];
  return (
    <svg className="toolArt" viewBox="0 0 320 150" role="img" aria-label="Tendința prețurilor pe zonă" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="maBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbf3e2" /><stop offset="1" stopColor="#f3e6c9" /></linearGradient>
        <linearGradient id="maArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f2a93b" stopOpacity="0.45" /><stop offset="1" stopColor="#f2a93b" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="320" height="150" fill="url(#maBg)" />
      {/* zone map in the background */}
      <g fill="none" stroke="#e3cf9f" strokeWidth="1">
        <path d="M0 30 C60 20 90 50 150 36 S260 10 320 26" /><path d="M0 74 C70 64 120 90 190 70 S280 52 320 60" />
        <path d="M70 0 C80 50 60 100 84 150" /><path d="M200 0 C190 60 220 100 206 150" />
      </g>
      {/* grid */}
      <g stroke="rgba(17,17,17,0.08)" strokeWidth="1">{[40, 70, 100, 130].map((y) => <line key={y} x1="0" x2="320" y1={y} y2={y} />)}</g>
      {/* volume bars */}
      <g fill="rgba(17,17,17,0.12)">{bars.map((h, i) => <rect key={i} x={10 + i * 40} y={150 - h * 0.28} width="16" height={h * 0.28} rx="2" />)}</g>
      {/* price trend */}
      <path d={`${line} L302 150 L18 150 Z`} fill="url(#maArea)" />
      <path d={line} fill="none" stroke="#111" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {trend.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === trend.length - 1 ? 5 : 3} fill={i === trend.length - 1 ? "#f2a93b" : "#fff"} stroke="#111" strokeWidth="1.6" />)}
      {/* comparables */}
      <g fontFamily="ui-monospace, Menlo, monospace" fontWeight="700" fontSize="8">
        <g transform="translate(36 30)"><rect x="-4" y="-11" width="62" height="16" rx="8" fill="#fff" stroke="#e0c58f" /><text x="4" y="0" fill="#111">1.480 €/mp</text></g>
        <g transform="translate(150 54)"><rect x="-4" y="-11" width="62" height="16" rx="8" fill="#fff" stroke="#e0c58f" /><text x="4" y="0" fill="#111">1.620 €/mp</text></g>
      </g>
      {/* headline value */}
      <g transform="translate(222 14)">
        <rect width="88" height="34" rx="10" fill="#111" />
        <text x="10" y="14" fontFamily="Verdana, sans-serif" fontSize="7" fontWeight="700" fill="#f2c27a">MEDIANA ZONEI</text>
        <text x="10" y="27" fontFamily="ui-monospace, Menlo, monospace" fontSize="10" fontWeight="700" fill="#fff">1.750 €/mp ▲</text>
      </g>
    </svg>
  );
}
