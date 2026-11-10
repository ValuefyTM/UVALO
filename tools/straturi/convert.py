# Cartierele Timișoarei + zonele de impozitare → localizare-data/straturi/timisoara.json ([lat,lng], 6 zecimale)
import json, math, sys
src, out = sys.argv[1], sys.argv[2]
def rings(g):
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    return [[[[round(y, 6), round(x, 6)] for x, y in r] for r in p] for p in polys]
def inside(pt, poly):
    y, x = pt; c = False
    for r in poly:
        for i in range(len(r)):
            (y1, x1), (y2, x2) = r[i], r[i - 1]
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
def segd(p, a, b):
    k = math.cos(math.radians(p[0]))
    ax, ay, bx, by, px, py = a[1]*k, a[0], b[1]*k, b[0], p[1]*k, p[0]
    dx, dy = bx-ax, by-ay; L = dx*dx+dy*dy
    t = 0 if L == 0 else max(0, min(1, ((px-ax)*dx+(py-ay)*dy)/L))
    return math.hypot(px-ax-t*dx, py-ay-t*dy)
def label(poly):  # punctul din interior cel mai departe de margini (grilă)
    r = poly[0]; ys = [p[0] for p in r]; xs = [p[1] for p in r]
    best, bd = None, -1
    for i in range(1, 50):
        for j in range(1, 50):
            p = [min(ys)+(max(ys)-min(ys))*i/50, min(xs)+(max(xs)-min(xs))*j/50]
            if not inside(p, poly): continue
            d = min(segd(p, rr[k], rr[k-1]) for rr in poly for k in range(len(rr)))
            if d > bd: bd, best = d, p
    return [round(best[0], 5), round(best[1], 5)] if best else r[0]
def area(poly):
    r = poly[0]; return abs(sum(a[1]*b[0]-b[1]*a[0] for a, b in zip(r, r[1:]+r[:1])))
cart = json.load(open(f"{src}/cartiere_timisoara_2024.geojson"))
zone = json.load(open(f"{src}/zone_impozitare_timisoara_2026.geojson"))
pct = {}
for i, line in enumerate(open(f"{src}/cartiere_x_zone_procent.csv", encoding="utf-8")):
    f = line.strip().split(",")
    if i and len(f) == 5: pct[" ".join(f[0].split())] = {z: round(float(v)) for z, v in zip("ABCD", f[1:]) if float(v) >= 1}
C = []
for f in cart["features"]:
    n = " ".join(f["properties"]["Eticheta"].split())
    for p in rings(f["geometry"]):
        C.append({"n": n, "r": p, "l": label(p), "z": pct.get(n, {})})
Z = []
for f in zone["features"]:
    z = f["properties"]["Zona de impozitare"].replace("Zona", "").strip()
    for p in rings(f["geometry"]):
        Z.append({"z": z, "r": p, **({"l": label(p)} if area(p) > 2e-5 else {})})
Z.sort(key=lambda x: x["z"])
hcl = zone["features"][0]["properties"]["HCL"]
json.dump({"uat": "timisoara", "zone": {"hcl": hcl, "an": 2026, "p": Z}, "cartiere": {"an": 2024, "p": C}}, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(C), "cartiere,", len(Z), "zone, HCL", hcl, sorted(set(c["n"] for c in C) - set(pct)))
