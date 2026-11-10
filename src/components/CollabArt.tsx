// Shared illustration for Colaborări (server and client components).
/** Colaborări illustration: the coverage zone, a post nearby and a short conversation (launch banner, recommend window, launch email). */
export function CollabArt({ className = "cbSplashSvg", fit = "slice" }: { className?: string; fit?: "slice" | "meet" }) {
  return (
    <svg className={className} viewBox="0 0 780 320" role="img" aria-label="Un anunț de inspecție în zona de acoperire, cu o conversație între doi evaluatori" preserveAspectRatio={`xMidYMid ${fit}`}>
      <rect width="780" height="320" fill="#141414" />
      <circle cx="150" cy="210" r="210" fill="none" stroke="#e0ad4f" strokeOpacity=".18" />
      <circle cx="150" cy="210" r="130" fill="#e0ad4f" fillOpacity=".06" stroke="#e0ad4f" strokeOpacity=".3" />
      <circle cx="150" cy="210" r="56" fill="#e0ad4f" fillOpacity=".16" stroke="#e0ad4f" strokeWidth="2" />
      <circle cx="150" cy="210" r="8" fill="#fff" stroke="#e0ad4f" strokeWidth="4" />
      <circle cx="248" cy="150" r="5" fill="#e0ad4f" /><circle cx="70" cy="140" r="5" fill="#e0ad4f" /><circle cx="250" cy="280" r="5" fill="#8d857a" />
      <g transform="translate(330 64) rotate(-4)" opacity=".85">
        <rect width="270" height="96" rx="14" fill="#2a2a2a" />
        <rect x="16" y="16" width="130" height="20" rx="10" fill="#f6dcc8" />
        <text x="81" y="30" textAnchor="middle" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="9" fontWeight="700" fill="#8a3a12">RAPORT + INSPECȚIE</text>
        <text x="16" y="60" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="14" fontWeight="700" fill="#fff">Casă P+M cu teren 900 mp</text>
        <text x="16" y="80" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="11" fill="#a79e92">Caransebeș, Caraș-Severin</text>
      </g>
      <g transform="translate(420 100)">
        <rect width="320" height="150" rx="14" fill="#fff" />
        <circle cx="34" cy="32" r="16" fill="#1a1714" />
        <text x="34" y="36" textAnchor="middle" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="10" fontWeight="700" fill="#e0ad4f">IM</text>
        <text x="58" y="29" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="12" fontWeight="700" fill="#1a1714">Ioana Mureșan</text>
        <text x="58" y="44" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="10" fill="#8d857a">EPI · acum 2 ore</text>
        <rect x="226" y="20" width="80" height="20" rx="10" fill="#fbebd0" />
        <text x="266" y="34" textAnchor="middle" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="9" fontWeight="700" fill="#8a5a00">INSPECȚIE</text>
        <text x="18" y="76" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="15" fontWeight="700" fill="#1a1714">Apartament 3 camere, bloc 1985</text>
        <rect x="18" y="90" width="100" height="22" rx="7" fill="#141414" />
        <text x="28" y="105" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="11" fontWeight="700" fill="#fff">Arad <tspan fill="#e0ad4f">≈ 62 km</tspan></text>
        <rect x="126" y="90" width="112" height="22" rx="7" fill="#fff" stroke="#efe4d3" />
        <text x="136" y="105" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="11" fill="#4a423a">Buget: <tspan fontWeight="700">250 lei</tspan></text>
        <rect x="204" y="120" width="100" height="22" rx="8" fill="#f2a93b" />
        <text x="254" y="135" textAnchor="middle" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="11" fontWeight="700" fill="#1a1714">Vreau detalii</text>
      </g>
      <g transform="translate(300 250)">
        <rect width="200" height="28" rx="14" fill="#f4ece1" />
        <text x="14" y="18" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="12" fill="#1a1714">Pot merge joi la 10. Ai CF-ul?</text>
        <rect x="70" y="36" width="160" height="28" rx="14" fill="#e0ad4f" />
        <text x="84" y="54" fontFamily="Plus Jakarta Sans, Verdana, sans-serif" fontSize="12" fontWeight="700" fill="#141414">Da, ți-l trimit acum.</text>
      </g>
    </svg>
  );
}
