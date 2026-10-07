# DWG (via LibreDWG JSON) → cadastral locator data files (same format as localizare-data/*.json).
import json, os, re, sys, unicodedata
OUTDIR = os.environ.get("OUTDIR", "/tmp/dwg/out")
from collections import defaultdict
from shapely.geometry import Polygon, Point, MultiPolygon
from shapely.strtree import STRtree
from shapely.ops import unary_union
from shapely.validation import make_valid
from pyproj import Transformer

TO_WGS = Transformer.from_crs(3844, 4326, always_xy=True)

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def clean_text(t):
    t = re.sub(r"\\[A-Za-z][^;\\{}]*;", "", t)  # MTEXT codes like \fArial|b0;
    t = t.replace("{", "").replace("}", "").replace("\\P", " ")
    return re.sub(r"\s+", " ", t).strip()

def load(path):
    d = json.load(open(path))
    objs = d["OBJECTS"]
    layers = {o["handle"][2]: o.get("name") or "" for o in objs if o.get("object") == "LAYER"}
    ents = []
    for o in objs:
        if "entity" not in o or o.get("entmode") != 2:
            continue
        o["_layer"] = layers.get((o.get("layer") or [0, 0, 0, 0])[-1], "")
        ents.append(o)
    return ents

def ring(o):
    if o["entity"] == "LWPOLYLINE":
        pts = [tuple(p[:2]) for p in o.get("points") or []]
    elif o["entity"] in ("POLYLINE_3D", "POLYLINE_2D"):
        pts = [tuple(v.get("point", [0, 0])[:2]) for v in o.get("vertex", []) if isinstance(v, dict)]
    else:
        return None
    if len(pts) >= 2 and pts[0] == pts[-1]:
        pts = pts[:-1]
    return pts if len(pts) >= 3 else None

def poly(pts):
    p = Polygon(pts)
    if not p.is_valid:
        p = make_valid(p)
        if isinstance(p, MultiPolygon) or p.geom_type == "GeometryCollection":
            ps = [g for g in getattr(p, "geoms", []) if g.geom_type == "Polygon"]
            p = max(ps, key=lambda g: g.area) if ps else Polygon(pts).buffer(0)
    return p

def text_of(o):
    t = o.get("text_value") or o.get("text") or ""
    pt = o.get("ins_pt") or o.get("insertion_pt") or [0, 0]
    return clean_text(t), (pt[0], pt[1])

def enc(pts):
    out, px, py = [], 0, 0
    for x, y in pts:
        X, Y = round(x * 1000), round(y * 1000)
        out += [X - px, Y - py]
        px, py = X, Y
    return out

TOPO_PREFIX = r"(?:A|DE|De|Dj|DJ|DN|Ds|DS|Dt|DT|DF|Df|Dc|DC|PS|Ps|P|HC|Hc|HCN|HCn|Hcn|CC|Cc|cc|CD|Cd|F|Ab|AB|Vi|Pd|sPd|Ar|L|N|Np|fic|cad|Cad)"
TOPO = re.compile(r"^(?:nr\.?\s*top\.?\s*)?" + TOPO_PREFIX + r"?\s?\d{1,5}[a-z]?(?:\s?[/\-,]\s?\d*[A-Za-z]?\d*)*$")
SKIP_TEXT_LAYERS = re.compile(r"ImobileE3_IE|DEN_INTRAVILANE|Sector|aviz|inregistrat|respins|AVIZAT|nr cad|cad noi|RECEPTII|EXPERTIZE|Intabulare", re.I)

def is_topo(t):
    if not t or len(t) > 40 or "S=" in t or "mp" in t.lower() or "ha" == t[-2:]:
        return False
    if not TOPO.match(t):
        return False
    if not re.search(r"[A-Za-z]", t) and "/" not in t:
        return False  # bare numbers: sector numbers, cadastral ids
    if re.fullmatch(r"\d{3,6}/(0\d|1\d|20\d\d|19\d\d)", t):
        return False  # registration numbers like 12970/07
    return True

def convert(name_file, uats_spec, src_label):
    ents = load(f"/tmp/dwg/js/{name_file}.json")
    by = defaultdict(list)
    for o in ents:
        by[o["_layer"]].append(o)

    # parcels and their ids
    polys = [(poly(r), o) for o in by["ImobileE3"] if (r := ring(o))]
    polys = [(p, o) for p, o in polys if p.area > 0.5]
    ids = [text_of(o) for o in by["ImobileE3_IE"] if o["entity"] in ("TEXT", "MTEXT")]
    tree = STRtree([p for p, _ in polys])
    # Every id text goes to the smallest parcel that contains it (or the nearest one within 15 m). A contour that holds
    # several ids (imobile drawn as one shape) is kept once per id, so each cadastral number can be found.
    pid = defaultdict(list)
    for t, xy in ids:
        if not re.fullmatch(r"\d{4,7}(?:-C\d+)?", t):
            continue
        pt = Point(xy)
        hits = sorted((int(i) for i in tree.query(pt) if polys[int(i)][0].contains(pt)), key=lambda i: polys[i][0].area)
        if not hits:
            near = sorted((int(i) for i in tree.query(pt.buffer(15))), key=lambda i: polys[i][0].distance(pt))
            hits = near[:1]
        if hits and t not in pid[hits[0]]:
            pid[hits[0]].append(t)
    parcels = [(polys[i][0], t) for i in sorted(pid) for t in pid[i]]
    bad = [t for t, _ in ids if not re.fullmatch(r"\d{4,7}(?:-C\d+)?", t)]
    print("  id texts", len(ids), "not ids", len(bad), bad[:8])
    print(name_file, "polygons", len(polys), "with id", len(parcels))

    buildings = [poly(r) for o in by["ConstructiiE3"] if (r := ring(o))]
    nb0 = len(buildings)
    buildings = [b for b in buildings if b.area > 1]
    # the same building drawn twice
    uniq = []
    for b in sorted(buildings, key=lambda b: -b.area):
        if not any(b.symmetric_difference(u).area < 0.02 * b.area for u in uniq[-50:] if u.intersects(b)):
            uniq.append(b)
    print("  buildings", len(by["ConstructiiE3"]), "rings", nb0, "area>1", len(buildings), "unique", len(uniq))
    buildings = uniq

    # topo texts
    topo = []
    for layer, lst in by.items():
        if SKIP_TEXT_LAYERS.search(layer):
            continue
        for o in lst:
            if o["entity"] not in ("TEXT", "MTEXT"):
                continue
            t, xy = text_of(o)
            t = re.sub(r"\s*-\s*\d+(?:[.,]\d+)?\s*m.*$", "", t) if re.search(r"-\s*\d+(?:[.,]\d+)?\s*m", t) else t
            if is_topo(t):
                topo.append((t, xy))

    # intravilan
    iv_polys = []
    for layer in ("limita_intravilan_5000",):
        for o in by.get(layer, []):
            r = ring(o)
            if r:
                iv_polys.append(poly(r))
    names = [text_of(o) for o in by.get("DEN_INTRAVILANE", []) if o["entity"] in ("TEXT", "MTEXT")]

    # UAT boundaries (a file can hold two communes): each parcel goes to the commune that contains it, else the nearest.
    out = []
    bounds = {}
    for key, uname, boundary_layer in uats_spec:
        rs = [poly(r) for o in by.get(boundary_layer, []) if (r := ring(o))] if boundary_layer else []
        bounds[key] = unary_union(rs) if rs else None
    def owner(pt):
        if len(uats_spec) == 1:
            return uats_spec[0][0]
        inside = [k for k, g in bounds.items() if g is not None and g.contains(pt)]
        if inside:
            return inside[0]
        rest = [k for k, g in bounds.items() if g is None]  # a commune without its own limit gets what is left
        return rest[0] if rest else min((k for k, g in bounds.items() if g is not None), key=lambda k: bounds[k].distance(pt))
    for key, uname, boundary_layer in uats_spec:
        bnd = None
        mine = [(p, i) for p, i in parcels if owner(p.representative_point()) == key]
        mine.sort(key=lambda x: -x[0].area)
        P = [p for p, _ in mine]
        t2 = STRtree(P)
        # neighbours
        nb = []
        for k, p in enumerate(P):
            near = set()
            edge = p.boundary.buffer(0.3)
            for j in t2.query(p.buffer(0.3)):
                if j == k or mine[j][1] == mine[k][1] or P[j] is P[k]:
                    continue
                if edge.intersection(P[j].boundary).length > 0.5:
                    near.add(mine[j][1])
            nb.append(sorted(near))
        # buildings
        B = []
        per = defaultdict(list)
        for b in buildings:
            c = b.representative_point()
            if owner(c) != key:
                continue
            hits = [j for j in t2.query(c) if P[j].contains(c)]
            j = int(hits[0]) if hits else -1
            per[j].append(b)
        for j, lst in per.items():
            lst.sort(key=lambda b: -b.area)
            for n, b in enumerate(lst, 1):
                B.append([f"C{n}", j, enc(list(b.exterior.coords)[:-1])])
        # topo
        T, ptopo = [], defaultdict(list)
        for t, xy in topo:
            pt = Point(xy)
            if owner(pt) != key:
                continue
            hits = [j for j in t2.query(pt) if P[j].contains(pt)]
            j = int(hits[0]) if hits else -1
            T.append([t, round(xy[0], 1), round(xy[1], 1), j])
            if j >= 0 and t not in ptopo[j]:
                ptopo[j].append(t)
        # intravilan
        IV, seen = [], []
        for ip in iv_polys:
            if owner(ip.representative_point()) != key:
                continue
            if any(ip.intersection(q).area > 0.8 * max(ip.area, q.area) for q in seen):
                continue
            seen.append(ip)
            named = [(ip.distance(Point(xy)), t) for t, xy in names if re.search(r"[A-Za-zăîâșțşţ]{3}", t)]
            inside = [t for d, t in named if d == 0]
            near = sorted(named)[:1]
            label = inside[0] if inside else (near[0][1] if near else uname)
            IV.append([label, enc(list(ip.exterior.coords)[:-1])])
        parcels_out = []
        for k, (p, i) in enumerate(mine):
            o = {"id": i, "a": round(p.area, 2), "n": nb[k]}
            if ptopo.get(k):
                o["t"] = ptopo[k]
            o["z"] = enc(list(p.exterior.coords)[:-1])
            parcels_out.append(o)
        data = {"uat": uname, "src": src_label + (" (separat pe comune)" if len(uats_spec) > 1 else ""), "parcels": parcels_out, "b": B, "t": T, "iv": IV}
        json.dump(data, open(f"{OUTDIR}/{key}.json", "w"), ensure_ascii=False, separators=(",", ":"))
        # overview: hull + bbox in WGS84
        area = unary_union([p.buffer(25) for p in P]).buffer(-20)
        if area.geom_type == "MultiPolygon":
            area = max(area.geoms, key=lambda g: g.area)
        hull = area.exterior.simplify(150)
        ll = [TO_WGS.transform(x, y) for x, y in hull.coords[:-1]]
        lats = [a[1] for a in ll]; lngs = [a[0] for a in ll]
        allpts = [TO_WGS.transform(x, y) for x, y in (P[0].exterior.coords[:1])]
        minx, miny, maxx, maxy = unary_union(P).bounds
        (lo1, la1), (lo2, la2) = TO_WGS.transform(minx, miny), TO_WGS.transform(maxx, maxy)
        out.append({"key": key, "name": uname, "n": len(parcels_out), "nb": len(B), "bb": [round(la1, 4), round(lo1, 4), round(la2, 4), round(lo2, 4)],
                    "hull": [[round(a[1], 5), round(a[0], 5)] for a in ll], "group": slug(name_file) if len(uats_spec) > 1 else None})
        print(f"  {key}: parcels {len(parcels_out)} ids {len(set(i for _, i in mine))} buildings {len(B)} topo {len(T)} iv {[x[0] for x in IV]} hull {len(ll)}")
    return out

SPEC = [
    ("Beba_Veche", [("beba-veche", "Beba Veche", None)], "Beba_Veche ortofoto.dwg · strat ImobileE3"),
    ("Sinnicolau_Mare", [("sinnicolau-mare", "Sânnicolau Mare", None)], "Sinnicolau_Mare ortofoto.dwg · strat ImobileE3"),
    ("Sinpetru_Mare_Saravale", [("sinpetru-mare", "Sânpetru Mare", "limita_5000_Sinpetru Mare"), ("saravale", "Saravale", "limita_5000_Saravale")],
     "Sinpetru_Mare_Saravale ortofoto.dwg · strat ImobileE3"),
    ("Teremia_Mare", [("teremia-mare", "Teremia Mare", None)], "Teremia_Mare ortofoto.dwg · strat ImobileE3"),
    ("Varias", [("varias", "Variaș", None)], "Varias ortofoto.dwg · strat ImobileE3"),
    ("Topolovatu_Mare", [("topolovatu-mare", "Topolovățu Mare", None)], "Topolovatu_Mare ortofoto.dwg · strat ImobileE3"),
]

SPEC += [
    ("Banloc_Livezile", [("banloc", "Banloc", "limita_5000_Banloc_Veche"), ("livezile", "Livezile", None)], "Banloc_Livezile ortofoto.dwg · strat ImobileE3"),
    ("Ciacova_Ghilad", [("ciacova", "Ciacova", "limita_5000_Ciacova"), ("ghilad", "Ghilad", "limita_5000_Ghilad")], "Ciacova_Ghilad ortofoto.dwg · strat ImobileE3"),
    ("Denta", [("denta", "Denta", None)], "Denta ortofoto.dwg · strat ImobileE3"),
    ("Deta", [("deta", "Deta", None)], "Deta ortofoto.dwg · strat ImobileE3"),
    ("Gataia_Birda", [("gataia", "Gătaia", "limita_5000_Gataia"), ("birda", "Birda", "limita_5000_Birda")], "Gataia_Birda ortofoto.dwg · strat ImobileE3"),
    ("Giera", [("giera", "Giera", None)], "Giera ortofoto.dwg · strat ImobileE3"),
    ("Jamu_Mare", [("jamu-mare", "Jamu Mare", None)], "Jamu Mare ortofoto.dwg · strat ImobileE3"),
    ("Jebel_Padureni", [("jebel", "Jebel", "limita_5000_Jebel_mod. conf. sentintei Padureni_Parta"), ("padureni", "Pădureni", "limita_5000_Padureni mod. conf. sentintei")],
     "Jebel_Padureni ortofoto.dwg · strat ImobileE3"),
    ("Liebling", [("liebling", "Liebling", None)], "Liebling ortofoto.dwg · strat ImobileE3"),
    ("Moravita", [("moravita", "Moravița", None)], "Moravita ortofoto.dwg · strat ImobileE3"),
    ("Tormac", [("tormac", "Tormac", None)], "Tormac ortofoto.dwg · strat ImobileE3"),
    ("Voiteg", [("voiteg", "Voiteg", None)], "Voiteg ortofoto.dwg · strat ImobileE3"),
]

if __name__ == "__main__":
    only = sys.argv[1:]
    res = []
    for f, spec, src in SPEC:
        if only and f not in only:
            continue
        res += convert(f, spec, src)
    json.dump(res, open(f"{OUTDIR}/uats-{'-'.join(only) or 'all'}.json", "w"), ensure_ascii=False)
