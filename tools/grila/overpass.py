# Descarcă pe dale (bbox-uri mici), cu reîncercări alternând oglinzile; unește după id.
import json, sys, time, urllib.request, urllib.parse
MIRRORS = ["https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
def q(query):
    for i in range(40):
        url = MIRRORS[i % len(MIRRORS)]
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, data=urllib.parse.urlencode({"data": query}).encode(), headers={"User-Agent": "uvalo-grila/1"}), timeout=400)
            b = r.read()
            if b[:200].find(b'"version"') >= 0: return json.loads(b)
            print("  răspuns neașteptat", b[:60]); 
        except Exception as e: print("  eroare", e)
        time.sleep(8)
    raise SystemExit("renunț")
def tiles(s, w, n, e, dy, dx):
    y = s
    while y < n:
        x = w
        while x < e:
            yield (round(y, 3), round(x, 3), round(min(y + dy, n), 3), round(min(x + dx, e), 3)); x += dx
        y += dy
kind, out = sys.argv[1], sys.argv[2]
els = {}
if kind == "streets":
    boxes = list(tiles(45.62, 21.02, 45.92, 21.42, 0.075, 0.1)) + [(45.76, 20.68, 45.82, 20.77)]
    for b in boxes:
        d = q('[out:json][timeout:120];way["highway"]["name"](%s,%s,%s,%s);out geom;' % b)
        for e in d["elements"]: els[e["id"]] = e
        print(b, len(d["elements"]), "total", len(els)); time.sleep(3)
elif kind == "places":
    d = q('[out:json][timeout:300];relation["boundary"="administrative"]["admin_level"~"^(8|9)$"](45.60,20.65,45.95,21.45);out geom;')
    for e in d["elements"]: els[("r", e["id"])] = e
    print("relații", len(d["elements"]))
    d = q('[out:json][timeout:300];node["place"~"^(city|town|village|suburb|neighbourhood|hamlet)$"](45.60,20.65,45.95,21.45);out;')
    for e in d["elements"]: els[("n", e["id"])] = e
    print("noduri", len(d["elements"]))
json.dump({"elements": list(els.values())}, open(out, "w"))
print("scris", out, len(els))
