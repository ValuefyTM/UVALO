# Listele de străzi pe zone din anexele 21–31 (pdftotext -layout) → JSON structurat
import re, json, sys, unicodedata
txt = open(sys.argv[1], encoding="utf-8").read().split("\n")
TYPES = {"str.", "bd.", "cale", "intr.", "alee", "p-ța", "splai", "scuar", "calea", "aleea", "str", "bd", "intrarea", "piața"}
TITLES = {"dr.", "prof.", "prof. dr.", "martir", "general", "maresal", "academician", "episcop", "mitropolit", "mitropolit dr.", "protopop",
          "arhitect", "locotenent", "colonel", "martir colonel", "sergent", "patriarh", "preot", "slt.", "arhimandrit", "profesor", "str. nouă"}
ZONE_RE = re.compile(r"^(\d|[A-E]|[0-9A-E]/[0-9A-E]|-|c)$")
# secțiunile: (titlu în text, cheia localității, are coloana Cartier?)
SECTIONS = [("Municipiul Timişoara", "timisoara"), ("Chișoda", "chisoda"), ("Dudeștii Noi", "dudestii-noi"), ("Dumbrăvița", "dumbravita"),
            ("Jimbolia", "jimbolia"), ("Ghiroda", "ghiroda"), ("Giroc", "giroc"), ("Moșnița Nouă", "mosnita-noua"), ("Moșnița Veche", "mosnita-veche"),
            ("Urseni", "urseni"), ("Șag", "sag"), ("Sânandrei", "sanandrei"), ("Săcălaz", "sacalaz")]
out, cur, seen_hdr = {}, None, False
i = 0
while i < len(txt):
    line = txt[i].rstrip()
    s = line.strip()
    # început de secțiune: „Nominalizarea străzilor pe zone aferente” + linia următoare = localitatea
    if s.startswith("Nominalizarea str"):
        nxt = txt[i + 1].strip()
        for t, k in SECTIONS:
            if nxt == t: cur = k; out.setdefault(cur, [])
        i += 2; continue
    mnr = re.match(r"^(\d+)\s+(\S.*)$", s)
    if cur and mnr and s != "2026" and "romprice" not in s:
        nr, rest_s = mnr.group(1), mnr.group(2)
        cols = [c.strip() for c in re.split(r"\s{2,}", rest_s) if c.strip()]
        # „Str. Nume” lipit cu un singur spațiu (rândurile 990+)
        if cols and " " in cols[0] and cols[0].split(" ", 1)[0].lower() in TYPES: cols = cols[0].split(" ", 1) + cols[1:]
        body = cols
        zone = None
        if body and ZONE_RE.match(body[-1]): zone = body.pop().upper()
        typ = None
        if body and body[0].lower() in TYPES: typ = body.pop(0)
        # Timișoara: [nume, (prenume), (titlu), cartier]; Dumbrăvița/Șag: [nume, cartier]; altele: [nume]
        rec = {"nr": int(nr), "zone": zone, "type": typ}
        if cur in ("timisoara", "dumbravita", "sag"):
            # cartierul e ultima coloană dacă au rămas ≥ 2; în Timișoara poate lipsi (rar)
            name = body[0] if body else ""
            rest = body[1:]
            cart = None
            if rest and rest[-1].lower() not in TITLES: cart = rest.pop()
            given, title = [], []
            for r in rest:
                (title if r.lower() in TITLES else given).append(r)
            rec.update({"name": name, "given": " ".join(given), "title": " ".join(title), "cartier": cart})
        else:
            rec.update({"name": " ".join(body)})
        # calificativ (segment) între paranteze
        m = re.search(r"\((.*)\)\s*$", rec["name"])
        if m and not re.match(r"^\(?(1918|1949)\)?$", m.group(1)):
            rec["seg"] = m.group(1).strip(); rec["name"] = rec["name"][:m.start()].strip()
        out[cur].append(rec)
    i += 1
for k, v in out.items():
    bad = [r for r in v if not r["zone"]]
    print(k, len(v), "fără zonă:", [(r["nr"], r["name"]) for r in bad][:5])
json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=0)
