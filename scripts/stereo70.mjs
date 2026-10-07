// Stereo 70 (EPSG:31700, double stereographic on Krasovsky) → WGS84 with the 7-parameter Helmert shift (PROJ towgs84
// convention). Same formulas as the cadastral locator page (localizare-data/index.html). E = Stereo Y (east), N = Stereo X (north).
const D = Math.PI / 180, a = 6378245, f = 1 / 298.3, e2 = 2 * f - f * f, e = Math.sqrt(e2);
const lat0 = 46 * D, lon0 = 25 * D, k0 = 0.99975, FE = 500000, FN = 500000;
const s0 = Math.sin(lat0), c0 = Math.cos(lat0);
const rho0 = (a * (1 - e2)) / Math.pow(1 - e2 * s0 * s0, 1.5), nu0 = a / Math.sqrt(1 - e2 * s0 * s0), R = Math.sqrt(rho0 * nu0);
const n = Math.sqrt(1 + (e2 * Math.pow(c0, 4)) / (1 - e2));
const S1 = (1 + s0) / (1 - s0), S2 = (1 - e * s0) / (1 + e * s0), w1 = Math.pow(S1 * Math.pow(S2, e), n);
const sx0 = (w1 - 1) / (w1 + 1), c = ((n + s0) * (1 - sx0)) / ((n - s0) * (1 + sx0)), w2 = c * w1, chi0 = Math.asin((w2 - 1) / (w2 + 1));
const g = 2 * R * k0 * Math.tan(Math.PI / 4 - chi0 / 2), h = 4 * R * k0 * Math.tan(chi0) + g;
const T = [2.329, -147.042, -92.08], rs = [-0.309, 0.325, 0.497].map((x) => (x / 3600) * D), sc = 1 + 5.69e-6;
const A = 6378137, F = 1 / 298.257223563, E2 = 2 * F - F * F, B = A * (1 - F), EP2 = (A * A - B * B) / (B * B);

export function stereo70ToWgs84(E, N) {
  const dE = E - FE, dN = N - FN;
  const i = Math.atan(dE / (h + dN)), j = Math.atan(dE / (g - dN)) - i;
  const chi = chi0 + 2 * Math.atan((dN - dE * Math.tan(j / 2)) / (2 * R * k0));
  const Lam = j + 2 * i + lon0, lon = (Lam - lon0) / n + lon0;
  const sc_ = Math.sin(chi), psi = (0.5 * Math.log((1 + sc_) / (c * (1 - sc_)))) / n;
  let phi = 2 * Math.atan(Math.exp(psi)) - Math.PI / 2;
  for (let k = 0; k < 10; k++) {
    const sp = Math.sin(phi);
    const psii = Math.log(Math.tan(phi / 2 + Math.PI / 4) * Math.pow((1 - e * sp) / (1 + e * sp), e / 2));
    const nx = phi - ((psii - psi) * Math.cos(phi) * (1 - e2 * sp * sp)) / (1 - e2);
    if (Math.abs(nx - phi) < 1e-14) { phi = nx; break; }
    phi = nx;
  }
  const sp = Math.sin(phi), cp = Math.cos(phi), Nn = a / Math.sqrt(1 - e2 * sp * sp);
  const X = Nn * cp * Math.cos(lon), Y = Nn * cp * Math.sin(lon), Z = Nn * (1 - e2) * sp;
  const [rx, ry, rz] = rs;
  const X2 = T[0] + sc * (X - rz * Y + ry * Z), Y2 = T[1] + sc * (rz * X + Y - rx * Z), Z2 = T[2] + sc * (-ry * X + rx * Y + Z);
  const p = Math.hypot(X2, Y2), th = Math.atan2(Z2 * A, p * B);
  const lat = Math.atan2(Z2 + EP2 * B * Math.pow(Math.sin(th), 3), p - E2 * A * Math.pow(Math.cos(th), 3));
  return [lat / D, Math.atan2(Y2, X2) / D];
}

/** Delta-encoded ring of the locator data (millimetres) → Stereo 70 metres. */
export function decodeRing(z) {
  const r = [];
  let x = 0, y = 0;
  for (let i = 0; i < z.length; i += 2) { x += z[i]; y += z[i + 1]; r.push([x / 1000, y / 1000]); }
  return r;
}

/** Centre of a polygon (area centroid in the plane; the mean of its corners for degenerate rings). */
export function centroid(ring) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const fct = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    A += fct; cx += (ring[j][0] + ring[i][0]) * fct; cy += (ring[j][1] + ring[i][1]) * fct;
  }
  if (Math.abs(A) < 1e-9) {
    const m = ring.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]);
    return [m[0] / ring.length, m[1] / ring.length];
  }
  return [cx / (3 * A), cy / (3 * A)];
}
