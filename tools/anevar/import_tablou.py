"""ANEVAR "Tabloul membrilor titulari" (PDF from anevar.ro) → SQL migration for the anevar_members table.

Usage: python3 tools/anevar/import_tablou.py tablou.pdf 2026-10-07 > migrations/00NN_tablou_YYYY_MM_DD.sql
Needs pdfplumber. Specializations are the "DA" columns, read by their position under the column headers.
"""
import collections, json, re, sys
import pdfplumber

COLS = ["EI", "EPI", "EBM", "EIF", "VE-EI", "VE-EPI", "VE-EBM", "VE-EIF"]
COUNTY = {
    "ALBA": "Alba", "ARAD": "Arad", "ARGES": "Argeș", "BACAU": "Bacău", "BIHOR": "Bihor", "BISTRITA-NASAUD": "Bistrița-Năsăud", "BOTOSANI": "Botoșani",
    "BRAILA": "Brăila", "BRASOV": "Brașov", "BUCURESTI": "București", "BUZAU": "Buzău", "CALARASI": "Călărași", "CARAS-SEVERIN": "Caraș-Severin",
    "CLUJ": "Cluj", "CONSTANTA": "Constanța", "COVASNA": "Covasna", "DAMBOVITA": "Dâmbovița", "DOLJ": "Dolj", "GALATI": "Galați", "GIURGIU": "Giurgiu",
    "GORJ": "Gorj", "HARGHITA": "Harghita", "HUNEDOARA": "Hunedoara", "IALOMITA": "Ialomița", "IASI": "Iași", "ILFOV": "Ilfov", "MARAMURES": "Maramureș",
    "MEHEDINTI": "Mehedinți", "MURES": "Mureș", "NEAMT": "Neamț", "OLT": "Olt", "PRAHOVA": "Prahova", "SALAJ": "Sălaj", "SATU MARE": "Satu Mare",
    "SIBIU": "Sibiu", "SUCEAVA": "Suceava", "TELEORMAN": "Teleorman", "TIMIS": "Timiș", "TULCEA": "Tulcea", "VALCEA": "Vâlcea", "VASLUI": "Vaslui",
    "VRANCEA": "Vrancea",
}


def title(s):
    return re.sub(r"(^|[\s.\-])([a-zăâîșț])", lambda m: m.group(1) + m.group(2).upper(), s.lower())


def parse(path):
    pdf = pdfplumber.open(path)
    prev, rows = None, []
    for p in pdf.pages:
        ws = p.extract_words()
        hdr = {w["text"]: (w["x0"] + w["x1"]) / 2 for w in ws if w["text"] in COLS}
        hdr = hdr if len(hdr) == 8 else prev
        prev = hdr
        lines = collections.defaultdict(list)
        for w in ws:
            lines[round(w["top"] / 3)].append(w)
        for k in sorted(lines):
            L = sorted(lines[k], key=lambda w: w["x0"])
            if not re.fullmatch(r"\d{1,5}", L[0]["text"]) or L[0]["x0"] > 90:
                continue
            legit = [w for w in L if re.fullmatch(r"\d{3,6}", w["text"]) and 220 < w["x0"] < 300]
            if not legit:
                continue
            lg = legit[0]
            name = " ".join(w["text"] for w in L[1:] if w["x0"] < lg["x0"])
            county = " ".join(w["text"] for w in L if lg["x1"] < w["x0"] < hdr["EI"] - 8 and w["text"] != "DA")
            specs = [min(COLS, key=lambda c: abs(hdr[c] - (w["x0"] + w["x1"]) / 2)) for w in L if w["text"] == "DA"]
            rows.append({"nr": int(L[0]["text"]), "name": title(name), "legit": lg["text"], "county": COUNTY.get(county, title(county)),
                         "specs": ",".join(c for c in COLS if c in specs)})
    return rows


if __name__ == "__main__":
    rows, date = parse(sys.argv[1]), sys.argv[2]
    q = lambda s: "'" + str(s).replace("'", "''") + "'"
    print(f"-- ANEVAR, tabloul membrilor titulari la {date}: {len(rows)} membri. Generat cu tools/anevar/import_tablou.py.")
    print(f"-- Cine nu mai apare în tablou rămâne în tabelă, cu in_current = 0.")
    print(f"UPDATE anevar_members SET in_current = 0;")
    for i in range(0, len(rows), 200):
        chunk = rows[i:i + 200]
        print("INSERT INTO anevar_members (legit, name, county, specs, nr, tablou_date, in_current) VALUES")
        print(",\n".join(f"({q(r['legit'])}, {q(r['name'])}, {q(r['county'])}, {q(r['specs'])}, {r['nr']}, {q(date)}, 1)" for r in chunk))
        print("ON CONFLICT(legit) DO UPDATE SET name = excluded.name, county = excluded.county, specs = excluded.specs, nr = excluded.nr, tablou_date = excluded.tablou_date, in_current = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');")
