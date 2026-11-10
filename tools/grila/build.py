# Grila notarială Timiș 2026 → straturi pentru localizator.
# Intrări: streets.json (anexele 21–31 parsate), valori.json, OSM (streets.json / addr.json / places.json din Overpass),
#          localizare-data/index.html (contururile UAT). Ieșire: grila-<uat>.json per UAT + raportul de potrivire.
import json, math, re, sys, os, collections
import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree
from shapely.geometry import LineString, MultiLineString, Point, Polygon, shape, mapping
from shapely.ops import linemerge, unary_union, nearest_points
from shapely import prepared
import rasterio.features, rasterio.transform
sys.path.insert(0, os.path.dirname(__file__))
from match import tokens, key, annex_tokens, score, strip, TITLE_W
TITLE_W.add("rabin"); TITLE_W.add("pictor")
from segs import parse_seg

ANNEX, VALORI, OSM, LOC, OUT = sys.argv[1:6]
T = Transformer.from_crs("EPSG:4326", "EPSG:3844", always_xy=True)   # WGS84 → Stereo 70 (E, N)
TI = Transformer.from_crs("EPSG:3844", "EPSG:4326", always_xy=True)
def xy(lat, lng): return T.transform(lng, lat)
def ll(x, y): lng, lat = TI.transform(x, y); return [round(lat, 5), round(lng, 5)]

# UAT-urile din localizator (hull în WGS84) și localitățile din anexe cu centrele lor (pentru UAT-urile compuse)
h = open(f"{LOC}/index.html", encoding="utf-8").read(); at = h.index("const UATS=") + len("const UATS=")
UATS = {u["key"]: u for u in json.loads(h[at:h.index("].map(u=>", at) + 1])}
# localitate din anexă → (UAT din localizator, centrul satului [lat, lng], schema de zone)
PLACES = {
    "timisoara": ("timisoara", [45.7489, 21.2087], "0-5"),
    "dumbravita": ("dumbravita", [45.7960, 21.2440], "A-E"),
    "giroc": ("giroc", [45.6990, 21.2360], "A-D"), "chisoda": ("giroc", [45.7050, 21.2190], "A-C"),
    "ghiroda": ("ghiroda", [45.7660, 21.2990], "A-B"),
    "mosnita-noua": ("mosnita-noua", [45.7280, 21.3130], "A-D"), "mosnita-veche": ("mosnita-noua", [45.7470, 21.3300], "A-D"), "urseni": ("mosnita-noua", [45.7160, 21.2930], "A-C"),
    "sag": ("sag", [45.6500, 21.1700], "A-B"), "sacalaz": ("sacalaz", [45.7620, 21.1050], "A-D"),
    "dudestii-noi": ("dudestii-noi", [45.8330, 21.0750], "A-C"), "jimbolia": ("jimbolia", [45.7920, 20.7210], "A"),
    "sanandrei": (None, [45.8520, 21.1700], "A-B"),
}
annex = json.load(open(ANNEX, encoding="utf-8"))
valori = json.load(open(VALORI, encoding="utf-8"))
osm_streets = json.load(open(f"{OSM}/streets.json"))["elements"]
osm_addr = json.load(open(f"{OSM}/addr.json"))["elements"]

# ---------- 1. străzile OSM: geometrie în Stereo 70, pe UAT și localitate ----------
HW = {"motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "pedestrian", "service", "road",
      "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link", "track", "cycleway", "footway", "path", "construction", "proposed"}
hulls = {}
for k, u in UATS.items():
    if "hull" in u and len(u["hull"]) >= 4: hulls[k] = Polygon([xy(a, b) for a, b in u["hull"]]).buffer(0)
pl_centers = {k: xy(*v[1]) for k, v in PLACES.items()}
by_uat = collections.defaultdict(list)   # uat → lista de sate ale anexei din el
for k, (uat, _, _) in PLACES.items():
    if uat: by_uat[uat].append(k)
# UAT-ul = cel al parcelei ANCPI celei mai apropiate (contururile UAT se suprapun la margini)
CEN = os.environ.get("CENTROIDS", ".open-next/assets/_localizare/c")
cpts, cuat = [], []
for uat in by_uat:
    d = json.load(open(f"{CEN}/{uat}.json"))
    for lat, lng in d["p"].values(): cpts.append(xy(lat, lng)); cuat.append(uat)
ctree = cKDTree(np.array(cpts)); print("centroide ANCPI:", len(cpts))
name_vill = collections.defaultdict(set)   # (uat, cheie nume) → satele din anexă care au strada
for v, recs in json.load(open(ANNEX, encoding="utf-8")).items():
    if v in PLACES and PLACES[v][0]:
        for r in recs: name_vill[(PLACES[v][0], key(annex_tokens(r)))].add(v)
def locality_of(pt, namekey=None):
    """Localitatea din anexă a punctului: UAT-ul parcelei celei mai apropiate (≤ 400 m), apoi satul care are strada în listă
    (sau cel mai apropiat centru de sat)."""
    ds, idx = ctree.query((pt.x, pt.y), k=60)
    if ds[0] > 400: return None
    uat = cuat[idx[0]]
    if namekey:
        for d, i in zip(ds, idx):
            if d > 1500: break
            if any(name_vill.get((cuat[i], namekey)) for _ in [0]): uat = cuat[i]; break
    vill = by_uat[uat]
    if len(vill) == 1: return vill[0]
    cand = name_vill.get((uat, namekey), set()) if namekey else set()
    if len(cand) == 1: return next(iter(cand))
    pool = cand or set(vill)
    return min(pool, key=lambda v: pt.distance(Point(pl_centers[v])))
ways = []      # {id, name, key, hw, line (Stereo70), loc}
for e in osm_streets:
    t = e.get("tags", {})
    if e["type"] != "way" or t.get("highway") not in HW or not t.get("name") or "geometry" not in e: continue
    pts = [xy(p["lat"], p["lon"]) for p in e["geometry"]]
    if len(pts) < 2: continue
    line = LineString(pts)
    loc = locality_of(line.interpolate(0.5, normalized=True), key(tokens(t["name"])))
    if not loc: continue
    ways.append({"id": e["id"], "name": t["name"], "key": key(tokens(t["name"])), "toks": tokens(t["name"]), "hw": t["highway"], "line": line, "loc": loc})
print("străzi OSM în localitățile zonate:", len(ways), collections.Counter(w["loc"] for w in ways))
# adresele: (key stradă, loc, nr, punct)
addrs = []
for e in osm_addr:
    t = e["tags"]; c = e.get("center") or e
    if "lat" not in c: continue
    m = re.match(r"^\s*(\d+)", t.get("addr:housenumber", ""))
    if not m: continue
    pt = Point(xy(c["lat"], c["lon"])); loc = locality_of(pt, key(tokens(t["addr:street"])))
    if loc: addrs.append({"key": key(tokens(t["addr:street"])), "loc": loc, "n": int(m.group(1)), "pt": pt})
print("adrese cu număr:", len(addrs))

# ---------- 2. potrivirea numelor din anexă cu străzile OSM, pe localitate ----------
groups = collections.defaultdict(list)   # (loc, key) → ways
for w in ways: groups[(w["loc"], w["key"])].append(w)
keys_by_loc = collections.defaultdict(dict)   # loc → {key: toks}
for (loc, k), ws in groups.items(): keys_by_loc[loc][k] = ws[0]["toks"]
TYPE_OSM = {"Str.": "strada", "Bd.": "bulevardul", "Cale": "calea", "Calea": "calea", "Intr.": "intrarea", "Alee": "aleea", "Aleea": "aleea", "P-ța": "piata", "splai": "splaiul", "scuar": "scuarul"}
ALIAS = {("timisoara", 21): "Strada Doina și Ion Aldea-Teodorovici", ("timisoara", 74): "Strada Ana Aslan", ("timisoara", 135): "Strada Behelei",
         ("timisoara", 242): "Centura Timișoara Nord", ("timisoara", 350): "Strada Dimitri Ivanovici Mendeleev", ("timisoara", 409): "Strada General Virgil Economu",
         ("timisoara", 414): "Strada Mircea Eliade", ("timisoara", 513): "Strada Iulian Grozescu", ("timisoara", 553): "Strada Sofia Imbroane",
         ("timisoara", 609): "Strada Wilhelm Conrad Röntgen", ("timisoara", 779): "Strada Adam Müller Guttenbrunn", ("timisoara", 808): "Strada Nikolai Nekrasov",
         ("timisoara", 815): "Strada Rabin Doctor Ernest Neumann", ("timisoara", 859): "Strada Giorgio Ostrogovich", ("timisoara", 869): "Strada Niccolò Paganini",
         ("timisoara", 876): "Strada Pantelimon Halippa", ("timisoara", 879): "Strada Dimitrije Pantic-Tirol", ("timisoara", 894): "Strada Ioan Radin Peianov",
         ("timisoara", 903): "Strada Johann Heinrich Pestalozzi", ("timisoara", 957): "Strada Johann Nepomuk Preyer",
         ("timisoara", 1057): "Strada Johann Schwicker", ("timisoara", 1090): "Strada Russu Șirianu",
         ("timisoara", 1167): "Strada Dimitrie Țichindeal", ("timisoara", 1202): "Strada Ioan Țuculescu", ("timisoara", 1282): "Strada Vuk Stefanović Karadžić"}
used_keys = set()   # cheile OSM potrivite exact de o intrare: nu mai pot fi luate aproximativ de alta (Istria ≠ Dora D'Istria)
def find_street(loc, rec, fuzzy=True):
    """Cheia OSM potrivită pentru o intrare din anexă (alias, exact, apoi aproximativ) și cum s-a potrivit."""
    at = annex_tokens(rec); k = key(at)
    cand = keys_by_loc.get(loc, {})
    al = ALIAS.get((loc, rec["nr"]))
    if al:
        ak = key(tokens(al))
        if ak in cand: return ak, "alias"
    if k in cand: return k, "exact"
    if not fuzzy: return None, None
    if re.match(r"^[\divxlc]+(-a)?$", strip(rec["name"])): return None, None   # străzi numerotate: fără aproximare
    # numele de familie (câmpul „name”) trebuie să fie cuprins; prenumele poate lipsi/diferi (Ion/Ioan, inițiale)
    surname = set(tokens(rec["name"]))
    best = (0, None)
    for ck, ct in cand.items():
        cs = set(ct)
        if ck in used_keys: continue
        if any(w["name"].startswith("Podul ") for w in groups[(loc, ck)]) and (rec.get("type") or "").lower() != "pod": continue
        if not all(any(close(a, b) for b in cs) for a in surname): continue   # numele de familie trebuie regăsit (cu o literă toleranță)
        exact_sur = surname <= cs
        # Jaccard pe jetoane, cu jetoanele apropiate considerate egale
        inter = sum(1 for a in set(at) if any(close(a, b) for b in cs))
        sc = inter / len(set(at) | cs - {b for b in cs if any(close(a, b) for a in set(at))})
        if sc >= (0.5 if exact_sur else 0.66) and sc > best[0]: best = (sc, ck)
    if best[1]: return best[1], f"aprox {best[0]:.2f}"
    return None, None
def close(a, b):
    if a == b: return True
    if abs(len(a) - len(b)) > 2 or len(a) < 5 or a[0] != b[0]: return False
    # o singură literă diferită / lipsă / în plus (Elisa/Eliza, Guttenbrum/Guttenbrunn), nu cuvinte diferite (Dacilor/Macilor)
    import difflib; ops = [o for o in difflib.SequenceMatcher(None, a, b).get_opcodes() if o[0] != "equal"]
    return len(ops) <= 1 and all(max(o[2] - o[1], o[4] - o[3]) <= 1 for o in ops) or (len(a) >= 8 and len(ops) <= 2 and all(max(o[2] - o[1], o[4] - o[3]) <= 1 for o in ops))

# ---------- 3. tronsoane ----------
def merged_line(ws):
    m = linemerge([w["line"] for w in ws]) if len(ws) > 1 else ws[0]["line"]
    return m
def spine_of(ws):
    """Linia de referință a străzii: cel mai lung drum prin rețeaua căilor OSM cu acest nume (capetele cele mai depărtate),
    ca pe arterele cu două sensuri / bretele să avem o singură axă pe care să măsurăm."""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import dijkstra
    nodes = {}; I, J, W = [], [], []
    def nid(c):
        c = (round(c[0], 1), round(c[1], 1))
        if c not in nodes: nodes[c] = len(nodes)
        return nodes[c]
    for w in ws:
        cs = list(w["line"].coords)
        for a, b in zip(cs, cs[1:]):
            i, j = nid(a), nid(b); d = math.dist(a, b)
            if i != j: I += [i, j]; J += [j, i]; W += [d, d]
    n = len(nodes)
    if n < 2: return ws[0]["line"]
    # muchii virtuale între nodurile apropiate ale unor căi diferite (sensuri paralele, mici întreruperi)
    deg = collections.Counter(I)
    endn = [k for k, v in nodes.items() if deg[v] <= 1]
    if 1 < len(endn) <= 3000:
        from scipy.spatial import cKDTree as KD
        allc = list(nodes.keys()); tr = KD(np.array(allc)); en = np.array(endn)
        endset = set(endn)
        for e, nb in zip(endn, tr.query_ball_point(en, 120.0)):
            for j in nb:
                c = allc[j]
                if c == e: continue
                d = math.dist(e, c)
                if d > 30 and c not in endset: continue     # peste 30 m doar capăt la capăt (sensuri giratorii cu alt nume între tronsoane)
                d += 15.0   # penalizare mică, ca drumul real să fie preferat
                I += [nodes[e], nodes[c]]; J += [nodes[c], nodes[e]]; W += [d, d]
    g = coo_matrix((W, (I, J)), shape=(n, n)).tocsr()
    # pornim din toate nodurile (sensurile paralele legate la capete formează bucle fără noduri de grad 1); eșantion la rețele mari
    ends = list(range(n)) if n <= 2500 else sorted(set([i for i in range(n) if g.indptr[i + 1] - g.indptr[i] == 1][:600] + list(range(0, n, max(1, n // 600)))))
    D, P = dijkstra(g, directed=False, indices=ends, return_predecessors=True)
    D[~np.isfinite(D)] = -1
    a, b = np.unravel_index(np.argmax(D), D.shape)
    path = [b]
    while path[-1] != ends[a] and P[a, path[-1]] >= 0: path.append(P[a, path[-1]])
    rev = {v: k for k, v in nodes.items()}
    return LineString([rev[i] for i in path[::-1]]) if len(path) > 1 else ws[0]["line"]
def longest_part(m):
    if isinstance(m, LineString): return m
    return max(m.geoms, key=lambda g: g.length)
def oriented(line, start_near):
    """Linia orientată cu începutul la capătul mai apropiat de centrul localității (numerotarea pornește de acolo)."""
    p0, p1 = Point(line.coords[0]), Point(line.coords[-1])
    return line if p0.distance(start_near) <= p1.distance(start_near) else LineString(line.coords[::-1])
def chain_of_street(line, loc, refkey):
    """Chainage-ul (m de la început) unde linia întâlnește strada de referință; None dacă nu o găsește la < 40 m."""
    best = None; rk = set(tokens(refkey))
    for (l, k), ws in groups.items():
        # strada de referință poate fi în satul vecin al aceluiași UAT sau peste limita UAT (Str. București la Dumbrăvița)
        if l != loc and PLACES.get(l, (None,))[0] != PLACES[loc][0] and not (loc == "timisoara" or PLACES[loc][0] == "timisoara"): continue
        ks = set(k.split(" "))
        if rk == ks or (rk <= ks and len(rk) >= 1 and all(len(x) > 3 for x in rk)):
            for w in ws:
                d = line.distance(w["line"])
                if d < 600:
                    p = nearest_points(line, w["line"])[0]; c = line.project(p)
                    if best is None or d < best[0]: best = (d, c)
    # < 80 m = intersecție (și pe arterele cu două sensuri); până la 600 m = punctul cel mai apropiat (OSM incomplet), marcat aproximativ
    if os.environ.get("DEBUG_REF") and os.environ["DEBUG_REF"] in refkey:
        cands = [(l, k, len(ws)) for (l, k), ws in groups.items() if set(k.split(" ")) == rk]
        dists = [round(line.distance(w["line"])) for (l, k), ws in groups.items() if set(k.split(" ")) == rk for w in ws]
        print("DEBUG", loc, refkey, "grupuri:", cands, "distanțe:", sorted(dists)[:5], "spină m:", round(line.length), "best:", best)
    if best is None: return None
    if best[0] >= 80: approx_refs.append((loc, refkey, round(best[0])))
    return best[1]
approx_refs = []
def chain_of_number(line, loc, skey, n, parity):
    """Chainage-ul numărului poștal n pe stradă, din adresele OSM ale străzii (interpolare între cele mai apropiate numere)."""
    allp = [(a["n"], line.project(a["pt"])) for a in addrs if a["loc"] == loc and a["key"] == skey and a["pt"].distance(line) < 80]
    pts = [p for p in allp if parity is None or p[0] % 2 == parity]
    if len(pts) < 3: pts = allp
    if len(pts) < 2: return None
    pts.sort()
    lo = [p for p in pts if p[0] <= n]; hi = [p for p in pts if p[0] > n]
    # interpolare liniară după numărul poștal între ultimul număr ≤ n și primul > n
    if lo and hi:
        (n0, c0), (n1, c1) = lo[-1], hi[0]
        return c0 + (c1 - c0) * ((n + 0.5 - n0) / (n1 - n0)) if n1 > n0 else (c0 + c1) / 2
    if lo:
        # dincolo de ultimul număr cunoscut: extrapolăm cu ritmul mediu (m / număr), fără a depăși capătul
        rate = (pts[-1][1] - pts[0][1]) / max(1, pts[-1][0] - pts[0][0]) if len(pts) > 1 else 10
        return min(line.length, pts[-1][1] + rate * (n - pts[-1][0]))
    rate = (pts[-1][1] - pts[0][1]) / max(1, pts[-1][0] - pts[0][0]) if len(pts) > 1 else 10
    return max(0.0, pts[0][1] - rate * (pts[0][0] - n))
def substring(line, a, b):
    a, b = max(0, min(a, b)), min(line.length, max(a, b))
    if b - a < 1: return None
    pts = [line.interpolate(a)] + [Point(c) for c in line.coords if a < line.project(Point(c)) < b] + [line.interpolate(b)]
    return LineString([(p.x, p.y) for p in pts])

report = {"unmatched": [], "approx": [], "segments": [], "notes": []}
for loc, recs in annex.items():
    if loc not in PLACES or not PLACES[loc][0]: continue
    for r in recs:
        k, how = find_street(loc, r, fuzzy=False)
        if k: used_keys.add(k)
out_streets = collections.defaultdict(list)   # loc → [{n, t, z, seg, side, l: [[lat,lng]...]}]
samples = collections.defaultdict(list)       # loc → [(x, y, zone, side)]   side: 0 ambele, 1 impar, 2 par, + sens
for loc, recs in annex.items():
    if loc not in PLACES or not PLACES[loc][0]: continue
    center = Point(pl_centers[loc])
    # intrările aceleiași străzi (același nume) se tratează împreună, ca tronsoanele să se completeze
    by_name = collections.defaultdict(list)
    for r in recs: by_name[key(annex_tokens(r))].append(r)
    for k, rs in by_name.items():
        r0 = rs[0]
        if r0["zone"] in ("-", None) and len(rs) == 1: report["notes"].append((loc, r0["nr"], r0["name"], r0.get("seg"))); continue
        skey, how = find_street(loc, r0)
        if not skey:
            report["unmatched"].append((loc, r0["nr"], (r0.get("type") or "") + " " + r0["name"] + " " + r0.get("given", ""), r0["zone"])); continue
        if how != "exact": report["approx"].append((loc, r0["nr"], r0["name"] + " " + r0.get("given", ""), "→", groups[(loc, skey)][0]["name"], how))
        ws = groups[(loc, skey)]
        disp = ws[0]["name"]
        odd_sign = 0   # pe ce parte a liniei orientate stau numerele impare (+1 stânga / −1 dreapta), din adresele OSM
        def emit(line, z, seg=None, side=0):
            if line is None or line.is_empty: return
            geoms = list(line.geoms) if hasattr(line, "geoms") else [line]
            for g in geoms:
                out_streets[loc].append({"n": disp, "z": z, **({"seg": seg} if seg else {}), **({"side": side} if side else {}), "l": [ll(*c) for c in g.coords]})
                L = g.length
                for d in np.arange(0, L + 1e-6, 8.0):
                    p = g.interpolate(min(d, L)); q = g.interpolate(min(d + 1, L))
                    samples[loc].append((p.x, p.y, z, side, math.atan2(q.y - p.y, q.x - p.x), odd_sign))
        if len(rs) == 1 and not rs[0].get("seg"):
            emit(MultiLineString([w["line"] for w in ws]), rs[0]["zone"]); continue
        # tronsoane: lucrăm pe linia unită, orientată dinspre centru
        main = oriented(spine_of(ws), center); L = main.length
        # sensul numerotării: după adresele OSM (numerele cresc cu chainage-ul), dacă sunt destule; altfel dinspre centru
        ad = [(a["n"], main.project(a["pt"])) for a in addrs if a["loc"] == loc and a["key"] == skey and a["pt"].distance(main) < 80]
        if len(ad) >= 3:
            nn = np.array([x[0] for x in ad], float); cc = np.array([x[1] for x in ad], float)
            if nn.std() > 0 and cc.std() > 0 and np.corrcoef(nn, cc)[0, 1] < -0.3: main = LineString(main.coords[::-1])
        sg_sum = 0
        for a in addrs:
            if a["loc"] == loc and a["key"] == skey and a["pt"].distance(main) < 80:
                c = main.project(a["pt"]); p = main.interpolate(c); q = main.interpolate(min(c + 1, L))
                cross = (q.x - p.x) * (a["pt"].y - p.y) - (q.y - p.y) * (a["pt"].x - p.x)
                sg_sum += (1 if cross > 0 else -1) * (1 if a["n"] % 2 else -1)
        odd_sign = 1 if sg_sum > 0 else -1 if sg_sum < 0 else 0
        pieces = []   # (a, b, zone, seg, side)
        rest = []     # zonele pentru „restul”
        halves = []   # (chainage, zone, seg): „între A și B” cu o singură referință găsită
        for r in rs:
            z = r["zone"]; sg = r.get("seg")
            if not sg: rest.append((z, None)); continue
            p = parse_seg(sg)
            if p["kind"] in ("note",): emit(MultiLineString([w["line"] for w in ws]), z); pieces = []; break
            if p["kind"] == "rest": rest.append((z, sg)); continue
            if p["kind"] == "until":
                c = chain_of_street(main, loc, p["a"])
                if c is None: report["segments"].append((loc, r["nr"], disp, sg, "NU am găsit strada de referință")); rest.append((z, sg)); continue
                pieces.append((0, c, z, sg, 0))
            elif p["kind"] == "from":
                c = chain_of_street(main, loc, p["a"]) if p["a"] != "sens metro 2" else None
                if p["a"] == "sens metro 2":
                    # sensul giratoriu de la Metro 2 (Calea Torontalului): coordonate fixe
                    c = main.project(Point(xy(45.7905, 21.1835)))
                if c is None: report["segments"].append((loc, r["nr"], disp, sg, "NU am găsit strada de referință")); rest.append((z, sg)); continue
                if p.get("dir"):
                    # partea dinspre X spre direcția dată
                    p0, p1 = main.interpolate(0), main.interpolate(L)
                    dx, dy = p1.x - p0.x, p1.y - p0.y
                    towards_end = {"W": dx < 0, "E": dx > 0, "N": dy > 0, "S": dy < 0}[p["dir"]]
                    pieces.append((c, L, z, sg, 0) if towards_end else (0, c, z, sg, 0))
                else: pieces.append((c, L, z, sg, 0))
            elif p["kind"] == "between":
                nums_a = re.findall(r"\d+", p["a"]) if re.fullmatch(r"[\d\s,a-z.]*", p["a"]) and re.search(r"\d", p["a"]) else None
                if nums_a:   # „de la 139, respectiv 102 până la str. X”: începe la numere, se termină la intersecție
                    ca = chain_of_number(main, loc, skey, min(int(x) for x in nums_a) - 1, None)
                    if ca is None: ca = 0; report["segments"].append((loc, r["nr"], disp, sg, "fără adrese OSM pentru începutul tronsonului"))
                else: ca = chain_of_street(main, loc, p["a"])
                cb = chain_of_street(main, loc, p["b"])
                if p["a"] == "centura": ca = L
                if p["b"] == "centura": cb = L
                if p["b"] == "vatra satului": cb = 0
                if ca is None and cb is None: report["segments"].append((loc, r["nr"], disp, sg, "referințe negăsite")); rest.append((z, sg)); continue
                if ca is None or cb is None:
                    c = ca if ca is not None else cb
                    report["segments"].append((loc, r["nr"], disp, sg, f"o referință negăsită ({'a' if ca is None else 'b'}): jumătatea de stradă estimată"))
                    halves.append((c, z, sg + " · tronson estimat")); continue
                pieces.append((min(ca, cb), max(ca, cb), z, sg, 0))
                if p.get("also"):
                    c2, c3 = chain_of_street(main, loc, p["also"][0]), chain_of_street(main, loc, p["also"][1])
                    if c2 is not None and c3 is not None: pieces.append((min(c2, c3), max(c2, c3), z, sg, 0))
            elif p["kind"] == "until_bridge":
                report["segments"].append((loc, r["nr"], disp, sg, "pod: tronson aproximat la jumătate")); pieces.append((0, L / 2, z, sg, 0))
            elif p["kind"] == "nums":
                for side, rng in ((1, p["odd"]), (2, p["even"])):
                    if not rng: continue
                    lo, hi = rng
                    a = 0 if lo <= 2 else chain_of_number(main, loc, skey, lo - 1, side % 2)
                    b = L if hi >= 9999 else chain_of_number(main, loc, skey, hi, side % 2)
                    if a is None or b is None:
                        # fără adrese OSM: împărțim proporțional după cât din numerotare acoperă (estimare)
                        fin = [n for q in rs for p2 in [parse_seg(q["seg"])] if q.get("seg") and p2["kind"] == "nums" for rr in (p2.get("odd"), p2.get("even")) if rr for n in rr if n < 9999]
                        nmax = max(fin + [x["n"] for x in addrs if x["loc"] == loc and x["key"] == skey]) * 1.25 if fin else hi + 40
                        a = 0 if a is None else a; b = L if (b is None and hi >= 9999) else (b if b is not None else L * min(1, hi / nmax))
                        report["segments"].append((loc, r["nr"], disp, sg, "fără adrese OSM: tăiere proporțională (estimare)")); sg = sg + " · tronson estimat"
                    sd = side if (p["odd"] != p["even"]) else 0
                    pieces.append((a, b, z, sg, sd))
        if os.environ.get("DEBUG_STREET") and os.environ["DEBUG_STREET"] in disp:
            print("PIECES", disp, "L", round(L), [(round(a), round(b), z, sd) for a, b, z, sg, sd in pieces], "rest", rest, "halves", halves,
                  "adrese:", sorted((a["n"], round(main.project(a["pt"]))) for a in addrs if a["loc"] == loc and a["key"] == skey and a["pt"].distance(main) < 80))
        for (c, z, sg) in halves:
            # partea (0..c sau c..L) mai puțin acoperită de tronsoanele deja cunoscute
            cov0 = sum(max(0, min(b, c) - max(a, 0)) for a, b, *_ in pieces); cov1 = sum(max(0, min(b, L) - max(a, c)) for a, b, *_ in pieces)
            pieces.append((0, c, z, sg, 0) if cov0 <= cov1 else (c, L, z, sg, 0))
        if not pieces and not rest: continue
        if not pieces:
            emit(MultiLineString([w["line"] for w in ws]), rest[0][0]); continue
        def zone_at(ch, side):
            for (a, b, z, sg, sd) in pieces:
                if a - 1 <= ch <= b + 1 and (sd == 0 or sd == side): return (z, sg, sd)
            if rest: return (rest[0][0], rest[0][1] or "rest", 0)
            # în afara tronsoanelor numite: tronsonul cel mai apropiat
            (a, b, z, sg, sd) = min(pieces, key=lambda p: min(abs(p[0] - ch), abs(p[1] - ch)))
            return (z, sg, 0)
        sided = any(p[4] for p in pieces)
        for w in ws:
            cs = list(w["line"].coords)
            chs = [main.project(Point(c)) for c in cs]
            for side in ((1, 2) if sided else (0,)):
                cur = None; buf = []
                for c, ch in zip(cs, chs):
                    zz = zone_at(ch, side)
                    if cur is not None and zz != cur:
                        mid = ((buf[-1][0] + c[0]) / 2, (buf[-1][1] + c[1]) / 2); buf.append(mid)
                        emit(LineString(buf), cur[0], cur[1], side if sided and cur[2] else 0); buf = [mid]
                    buf.append(c); cur = zz
                if len(buf) > 1: emit(LineString(buf), cur[0], cur[1], side if sided and cur[2] else 0)

# aceeași linie emisă pe ambele părți cu aceeași zonă → o singură dată, fără parte
for loc in list(out_streets):
    seen = {}
    for st in out_streets[loc]:
        kk = (st["n"], st["z"], st.get("seg"), tuple(map(tuple, st["l"])))
        if kk in seen and st.get("side") and seen[kk].get("side") and seen[kk]["side"] != st["side"]: seen[kk].pop("side", None); continue
        seen.setdefault(kk, st)
    out_streets[loc] = list(seen.values())
# ---------- 4. suprafețele zonelor: grilă 15 m, zona străzii zonate celei mai apropiate ----------
CELL = 15.0; REACH = 220.0
ZORDER = {"0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "4/5": 4, "A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "B/C": 1, "C/D": 2}
zones_out = {}
for uat, vill in by_uat.items():
    pts = [s for v in vill for s in samples.get(v, [])]
    if not pts or uat not in hulls: continue
    P = np.array([(s[0], s[1]) for s in pts]); Z = [s[2] for s in pts]; SIDE = np.array([s[3] for s in pts]); ANG = np.array([s[4] for s in pts]); OS = np.array([s[5] for s in pts])
    tree = cKDTree(P)
    hull = Polygon([xy(a, b) for a, b in UATS[uat]["hull"]]).buffer(0)
    minx, miny, maxx, maxy = hull.bounds
    nx, ny = int((maxx - minx) / CELL) + 1, int((maxy - miny) / CELL) + 1
    gx, gy = np.meshgrid(minx + (np.arange(nx) + .5) * CELL, maxy - (np.arange(ny) + .5) * CELL)
    G = np.column_stack([gx.ravel(), gy.ravel()])
    k = min(6, len(P))
    d, idx = tree.query(G, k=k, distance_upper_bound=REACH)
    zid = {z: i + 1 for i, z in enumerate(sorted(set(Z), key=lambda z: ZORDER.get(z, 9)))}
    ras = np.zeros(len(G), dtype=np.int32)
    for row in range(len(G)):
        for j in range(k):
            i = idx[row, j]
            if i >= len(P): break
            if SIDE[i]:
                # punct cu zonă doar pe o parte a străzii: verificăm partea (stânga/dreapta față de sensul liniei)
                cross = math.cos(ANG[i]) * (G[row, 1] - P[i, 1]) - math.sin(ANG[i]) * (G[row, 0] - P[i, 0])
                if OS[i] != 0:
                    want = OS[i] if SIDE[i] == 1 else -OS[i]
                    if (1 if cross > 0 else -1) != want: continue
            ras[row] = zid[Z[i]]; break
    ras = ras.reshape(ny, nx)
    # mascăm în afara UAT-ului
    tr = rasterio.transform.from_origin(minx, maxy, CELL, CELL)
    mask = rasterio.features.rasterize([(mapping(hull), 1)], out_shape=(ny, nx), transform=tr, fill=0, dtype="uint8")
    ras = np.where(mask == 1, ras, 0)
    polys = collections.defaultdict(list)
    for geom, val in rasterio.features.shapes(ras.astype("int32"), mask=ras > 0, transform=tr, connectivity=8):
        g = shape(geom)
        if g.area < 4 * CELL * CELL: continue
        polys[int(val)].append(g)
    inv = {v: z for z, v in zid.items()}
    zl = []
    for val, gs in polys.items():
        # rotunjim treptele grilei (închidere morfologică), apoi simplificăm
        u = unary_union(gs).buffer(CELL * 0.7, join_style=1).buffer(-CELL * 0.7, join_style=1).simplify(5, preserve_topology=True)
        for g in (u.geoms if hasattr(u, "geoms") else [u]):
            if g.area < 8 * CELL * CELL: continue
            rings = [[ll(*c) for c in g.exterior.coords]] + [[ll(*c) for c in r.coords] for r in g.interiors if Polygon(r).area > 20 * CELL * CELL]
            zl.append({"z": inv[val], "r": rings})
    zones_out[uat] = zl
    print(uat, "zone:", collections.Counter(z["z"] for z in zl), "străzi zonate:", sum(len(out_streets[v]) for v in vill))

# ---------- 5. scriere ----------
os.makedirs(OUT, exist_ok=True)
for uat, vill in by_uat.items():
    if uat not in zones_out: continue
    streets = [{**s, "loc": v} for v in vill for s in out_streets.get(v, [])]
    sch = {v: PLACES[v][2] for v in vill}
    json.dump({"uat": uat, "an": valori["an"], "sursa": valori["sursa"], "scheme": sch, "streets": streets, "zones": zones_out[uat]},
              open(f"{OUT}/grila-{uat}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump(valori, open(f"{OUT}/grila-valori.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
report["approx_refs"] = approx_refs
json.dump(report, open(f"{OUT}/raport.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("nepotrivite:", len(report["unmatched"]), "aproximative:", len(report["approx"]), "tronsoane cu probleme:", len(report["segments"]))
