# ANCPI DXF export (layers "T_A1S1_<UAT>_<date>" with the parcels and "<UAT>_constructiie3" with the buildings) →
# update of a locator data file (localizare-data/<key>.json) and of its entry in localizare-data/index.html.
# Nothing of the current version is lost: parcels and buildings that are not in the export are kept (the new ones win
# where they overlap), and the topo numbers and the intravilan limits, which the export does not have, stay as they
# are (the topo numbers are linked again to the parcels).
#
#   python3 tools/dxf/convert.py <file.dxf> <key>        e.g.  python3 tools/dxf/convert.py CHEVERESU_MARE.dxf cheveresu-mare
import json, os, re, sys
from collections import defaultdict
import ezdxf
from shapely.geometry import Point, Polygon
from shapely.strtree import STRtree
from shapely.ops import unary_union

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dwg"))
from convert import poly, enc, clean_text, TO_WGS  # noqa: E402  (the same geometry helpers as the DWG converter)

DATA = "localizare-data"
ID = re.compile(r"\d{4,7}")
BUILDING = re.compile(r"(\d{4,7})-(C\d+)")


def dec(z):
    pts, x, y = [], 0, 0
    for i in range(0, len(z), 2):
        x += z[i]; y += z[i + 1]
        pts.append((x / 1000, y / 1000))
    return pts


def read(path):
    doc = ezdxf.readfile(path)
    msp = doc.modelspace()
    layers = {e.dxf.layer for e in msp}
    plan = [l for l in layers if re.match(r"T_A1S1_.+_\d{4}-\d{2}-\d{2}$", l)]
    if len(plan) != 1:
        sys.exit(f"Nu găsesc stratul cu parcele (T_A1S1_<UAT>_<data>) în {path}: {sorted(layers)}")
    plan = plan[0]
    date = plan.rsplit("_", 1)[1]
    built = [l for l in layers if re.search(r"constructii", l, re.I)]
    by = defaultdict(list)
    for e in msp:
        by[e.dxf.layer].append(e)

    def rings(layer):
        out = []
        for e in by[layer]:
            if e.dxftype() == "LWPOLYLINE":
                pts = [(p[0], p[1]) for p in e.get_points("xy")]
            elif e.dxftype() == "POLYLINE":
                pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
            else:
                continue
            if len(pts) >= 2 and pts[0] == pts[-1]:
                pts = pts[:-1]
            if len(pts) >= 3:
                out.append(poly(pts))
        return out

    def texts(layer):
        return [(clean_text(e.text if e.dxftype() == "MTEXT" else e.dxf.text), (e.dxf.insert.x, e.dxf.insert.y))
                for e in by[layer] if e.dxftype() in ("TEXT", "MTEXT")]

    return plan, date, rings(plan), texts(plan), [p for l in built for p in rings(l)], [t for l in built for t in texts(l)]


def assign(polys, labels, pattern, near=15):
    """Each label goes to the smallest polygon containing it, else the nearest one within `near` m."""
    tree = STRtree(polys)
    out = defaultdict(list)
    for t, xy in labels:
        if not pattern.fullmatch(t):
            continue
        pt = Point(xy)
        hits = sorted((int(i) for i in tree.query(pt) if polys[int(i)].contains(pt)), key=lambda i: polys[i].area)
        if not hits:
            hits = sorted((int(i) for i in tree.query(pt.buffer(near))), key=lambda i: polys[i].distance(pt))[:1]
        if hits and t not in out[hits[0]]:
            out[hits[0]].append(t)
    return out


def main(path, key):
    old = json.load(open(f"{DATA}/{key}.json"))
    plan, date, ppolys, plabels, bpolys, blabels = read(path)
    ppolys = [p for p in ppolys if p.area > 0.5]
    pid = assign(ppolys, plabels, ID)
    mine = sorted(((ppolys[i], t) for i in pid for t in pid[i]), key=lambda x: -x[0].area)
    P = [p for p, _ in mine]
    tree = STRtree(P)
    first = {}
    for k, (_, i) in enumerate(mine):
        first.setdefault(i, k)
    print(f"{key}: strat {plan} · {len(plabels)} etichete · {len(mine)} parcele cu nr. cadastral")

    # neighbours: the same rule as the DWG converter (a shared edge longer than 0.5 m)
    nb = []
    for k, p in enumerate(P):
        near, edge = set(), p.boundary.buffer(0.3)
        for j in tree.query(p.buffer(0.3)):
            j = int(j)
            if j == k or mine[j][1] == mine[k][1] or P[j] is P[k]:
                continue
            if edge.intersection(P[j].boundary).length > 0.5:
                near.add(mine[j][1])
        nb.append(sorted(near))

    # Parcels of the current version that are not in the export are kept (marked "o": from an earlier plan), after
    # the new ones; the new parcels win where they overlap.
    old_parcels = old["parcels"]
    new_ids = {i for _, i in mine}
    kept = [(Polygon(dec(o["z"])), o) for o in old_parcels if o["id"] not in new_ids]
    kept = [(p if p.is_valid else p.buffer(0), o) for p, o in kept]
    K = [p for p, _ in kept]
    ktree = STRtree(K) if K else None
    base = len(mine)
    for k, (_, o) in enumerate(kept):
        first.setdefault(o["id"], base + k)

    def parcel_at(pt):
        hits = [int(j) for j in tree.query(pt) if P[int(j)].contains(pt)]
        if hits:
            return min(hits, key=lambda j: P[j].area)
        hits = [int(j) for j in ktree.query(pt) if K[int(j)].contains(pt)] if ktree else []
        return base + min(hits, key=lambda j: K[j].area) if hits else -1

    # buildings: their own number (400963-C19 → C19 on parcel 400963), else the parcel that contains them
    bpolys = [b for b in bpolys if b.area > 1]
    # The labels of small buildings are written a few metres outside them: each label goes to the nearest building
    # within 8 m, the closest pairs first, one label per building.
    btree = STRtree(bpolys)
    pairs = []
    for t, xy in blabels:
        if BUILDING.fullmatch(t):
            pt = Point(xy)
            pairs += [(bpolys[int(i)].distance(pt), t, int(i)) for i in btree.query(pt.buffer(8))]
    bl, taken = {}, set()
    for dist, t, i in sorted(pairs):
        if i not in bl and t not in taken and dist <= 8:
            bl[i] = [t]; taken.add(t)
    print(f"  etichete construcții: {sum(1 for t, _ in blabels if BUILDING.fullmatch(t))} · legate de un contur {len(taken)}")
    B, seen = [], set()
    for i, b in enumerate(bpolys):
        z = enc(list(b.exterior.coords)[:-1])
        sig = tuple(z[:6])
        if sig in seen:
            continue
        seen.add(sig)
        labels = bl.get(i) or [None]
        m = BUILDING.fullmatch(labels[0]) if labels[0] else None
        j = first.get(m.group(1), -1) if m else -1
        if j < 0:
            j = parcel_at(b.representative_point())
        B.append([m.group(2) if m else "", j, z])
    # buildings of the current version that no new building covers are kept, on the same parcel number
    nb_new = len(B)
    if old.get("b"):
        newb = [Polygon(dec(r[2])) for r in B]
        ntree = STRtree(newb) if newb else None
        for c, j, z in old["b"]:
            ob = Polygon(dec(z))
            ob = ob if ob.is_valid else ob.buffer(0)
            if ntree is not None and any(ob.intersection(newb[int(i)]).area > 0.5 * min(ob.area, newb[int(i)].area) for i in ntree.query(ob)):
                continue
            pid = old_parcels[j]["id"] if 0 <= j < len(old_parcels) else None
            jj = first.get(pid, -1) if pid else -1
            if jj < 0:
                jj = parcel_at(ob.representative_point())
            B.append(["", jj, z, c])
    # unnamed buildings (and kept ones whose number is taken) get the next free number of their parcel
    used = defaultdict(set)
    for r in B[:nb_new]:
        if r[0]:
            used[r[1]].add(r[0])
    for r in B:
        want = r.pop() if len(r) == 4 else None
        if want and want not in used[r[1]]:
            r[0] = want
            used[r[1]].add(want)
        if not r[0]:
            n = 1
            while f"C{n}" in used[r[1]]:
                n += 1
            r[0] = f"C{n}"
            used[r[1]].add(r[0])
    B.sort(key=lambda r: (r[1], int(r[0][1:])))

    # topo numbers and intravilan from the current version
    T, ptopo = [], defaultdict(list)
    for t, x, y, _ in old.get("t", []):
        j = parcel_at(Point(x, y))
        T.append([t, x, y, j])
        if j >= 0 and t not in ptopo[j]:
            ptopo[j].append(t)

    parcels = []
    for k, (p, i) in enumerate(mine):
        o = {"id": i, "a": round(p.area, 2), "n": nb[k]}
        if ptopo.get(k):
            o["t"] = ptopo[k]
        o["z"] = enc(list(p.exterior.coords)[:-1])
        parcels.append(o)
    for k, (_, o) in enumerate(kept):
        o = {key_: v for key_, v in o.items() if key_ != "t"}
        o["o"] = 1
        if ptopo.get(base + k):
            o["t"] = ptopo[base + k]
        parcels.append(o)
    d, mth, y = date.split("-")[2], date.split("-")[1], date.split("-")[0]
    data = {"uat": old["uat"], "src": f"Export ANCPI din {d}.{mth}.{y} · {os.path.basename(path)} (completat cu planul anterior)",
            "date": date, "parcels": parcels, "b": B, "t": T, "iv": old.get("iv", [])}

    # what changed
    op = {p["id"]: p for p in old["parcels"]}
    np_ = {p["id"]: p for p in parcels[:base]}
    changed = sum(1 for i in op.keys() & np_.keys() if abs(op[i]["a"] - np_[i]["a"]) > max(1, 0.01 * op[i]["a"]))
    print(f"  parcele: {len(op)} → {len(parcels)} · noi {len(np_.keys() - op.keys())} · modificate {changed} · păstrate din planul anterior {len(kept)}")
    print(f"  construcții: {len(old.get('b', []))} → {len(B)} (din export {nb_new}, păstrate {len(B) - nb_new}) · nr. topo {len(T)} (în parcele {sum(1 for t in T if t[3] >= 0)}) · intravilan {[x[0] for x in data['iv']]}")

    json.dump(data, open(f"{DATA}/{key}.json", "w"), ensure_ascii=False, separators=(",", ":"))

    # the entry in the UAT list of the locator page: counts, bounding box and outline
    area = unary_union([p.buffer(25) for p in P + K]).buffer(-20)
    if area.geom_type == "MultiPolygon":
        area = max(area.geoms, key=lambda g: g.area)
    ll = [TO_WGS.transform(x, y) for x, y in area.exterior.simplify(150).coords[:-1]]
    minx, miny, maxx, maxy = unary_union(P + K).bounds
    (lo1, la1), (lo2, la2) = TO_WGS.transform(minx, miny), TO_WGS.transform(maxx, maxy)
    html = open(f"{DATA}/index.html", encoding="utf8").read()
    m = re.search(r'\{"key":"' + re.escape(key) + r'"[^{}]*\}', html)
    if not m:
        sys.exit(f"Nu găsesc {key} în lista UATS din {DATA}/index.html")
    entry = json.loads(m.group(0))
    entry.update({"n": len(parcels), "nb": len(B), "bb": [round(la1, 4), round(lo1, 4), round(la2, 4), round(lo2, 4)],
                  "hull": [[round(a[1], 5), round(a[0], 5)] for a in ll]})
    html = html[:m.start()] + json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + html[m.end():]
    open(f"{DATA}/index.html", "w", encoding="utf8").write(html)
    print(f"  scris {DATA}/{key}.json și intrarea din index.html")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__ or "python3 tools/dxf/convert.py <file.dxf> <key>")
    main(sys.argv[1], sys.argv[2])
