# Calificativele de tronson din anexe („1-59, respectiv 2-76”, „între str. X și str. Y”, „de la str. X spre vest”) → structură.
import re, unicodedata
def strip(s): return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)).lower()
DIRS = {"vest": "W", "est": "E", "nord": "N", "sud": "S"}
NOTES = {"tapia", "intrarea", "se solicita incadrare", "sunt 2 strazi cu aceeasi denumire, se va solicita localizare", "denumire veche dealul mare"}
def clean_ref(x):
    """„str. Grigore Alexandrescu”, „C. AiI. Cuza”, „b. Antenei”, „Al. Viilor” → numele străzii de referință, fără tipul ei."""
    x = x.strip(" .")
    x = re.sub(r"^(str\.?|strada|bd\.?|b\.|bulevardul|cale[a]?|c\.|al\.|aleea|intr\.?|intersectia cu|intersec[tț]ia cu|calea)\s+", "", strip(x)).strip()
    x = re.sub(r"^(str\.?|strada|bd\.?)\s+", "", x).strip()       # „str. str Ștefan Procopiu”
    return {"aii cuza": "alexandru ioan cuza", "c aii cuza": "alexandru ioan cuza", "div9 cavalerie": "divizia 9 cavalerie", "div.9 cavalerie": "divizia 9 cavalerie", "div 9 cavalerie": "divizia 9 cavalerie",
            "timisorii": "timisoarei", "soseaua de centura": "centura", "bucuresti - dumbravita": "bucuresti", "privighetorii/capat": "privighetorii"}.get(x, x)
def num(s): return int(re.sub(r"[^\d]", "", s))
def parse_seg(seg):
    s = strip(seg).replace("antre ", "intre ").replace("gloria bd. sudului", "gloria si bd. sudului").strip()
    s = re.sub(r"\s+", " ", s)
    if s in NOTES: return {"kind": "note", "text": seg}
    if s == "restul strazii": return {"kind": "rest"}
    # --- numere poștale ---
    NUMW = {"respectiv","resp","pana","pina","la","nr","doar","numerele","pare","impare","toate","de","si","a"}
    if re.search(r"\d", s) and all(w in NUMW for w in re.findall(r"[a-z]+", s)):
        odd = even = None; both = None
        s2 = s.replace("respectiv", ",").replace("resp.", ",").replace(" si ", ",").replace("nr.", "").replace("nr", "").replace("pana la", "-").replace("de la", ">=").replace(" la ", "-")
        if "doar numerele pare" in s: m = re.findall(r"\d+", s); return {"kind": "nums", "even": [num(m[0]), num(m[1])], "odd": None}
        if "toate impare" in s2 or "toate nr. impare" in s or "impare" in s: m = re.findall(r"\d+", s); return {"kind": "nums", "odd": [1, 9999], "even": [num(m[-1]), 9999]}
        if "pare" in s and "pana la" in s:   # „până la 74 și nr. pare”
            m = re.findall(r"\d+", s); return {"kind": "nums", "odd": [1, num(m[0])], "even": [2, 9999]}
        upper = s.startswith("pana la")
        parts = [p.strip() for p in s2.split(",") if p.strip()]
        if upper: parts = [p if p.startswith("-") else "-" + p for p in parts]
        rng = []
        for p in parts:
            m = re.match(r"^(?:>=)?\s*(\d+)[a-z]?$", p)
            if m: rng.append([num(m.group(1)), 9999]); continue
            m = re.match(r"^(?:>=)?\s*(\d+)[a-z]?\s*-\s*(\d+)[a-z]?$", p)
            if m: rng.append([num(m.group(1)), num(m.group(2))]); continue
            m = re.match(r"^-\s*(\d+)[a-z]?$", p)        # „până la 85”
            if m: rng.append([1, num(m.group(1))]); continue
            m = re.match(r"^(\d+)[a-z]?$", p)
            if m: rng.append([num(m.group(1)), 9999]); continue
            return {"kind": "unknown", "text": seg}
        for r in rng:
            lo = r[0]
            if lo % 2 == 1 and odd is None: odd = r
            elif lo % 2 == 0 and even is None: even = r
            else: (even if odd is not None else odd) ; 
        if len(rng) == 1: odd = even = rng[0]           # „de la 75” → ambele părți
        if len(rng) == 2 and (odd is None or even is None): odd, even = rng[0], rng[1]   # parități egale (greșeală de tipar): le luăm în ordine
        return {"kind": "nums", "odd": odd, "even": even}
    # --- intersecții ---
    m = re.match(r"^(?:intre|între) (.+?) (?:si|și) (.+?)(?: (?:si|și) intre (.+?) (?:si|și) (.+))?$", s)
    if m:
        out = {"kind": "between", "a": clean_ref(m.group(1)), "b": clean_ref(m.group(2))}
        if m.group(3): out["also"] = [clean_ref(m.group(3)), clean_ref(m.group(4))]
        return out
    m = re.match(r"^de la (.+?) (?:pana la|pînă la) (.+)$", s)
    if m: return {"kind": "between", "a": clean_ref(m.group(1)), "b": clean_ref(m.group(2))}
    m = re.match(r"^(?:pana la|pînă la) (?:intersectia cu )?(.+)$", s)
    if m:
        ref = clean_ref(m.group(1)); return {"kind": "until", "a": ref} if ref != "pod" else {"kind": "until_bridge"}
    m = re.match(r"^(?:de la|dupa intersectia cu|de la intersectia cu) (.+?)(?: spre (vest|est|nord|sud))?$", s)
    if m: return {"kind": "from", "a": clean_ref(m.group(1)), "dir": DIRS.get(m.group(2))}
    return {"kind": "unknown", "text": seg}
if __name__ == "__main__":
    import json, sys
    d = json.load(open(sys.argv[1]))
    for k, v in d.items():
        for r in v:
            if r.get("seg"):
                p = parse_seg(r["seg"]); flag = "  <<<" if p["kind"] == "unknown" else ""
                print(k[:5], r["nr"], r["name"], "|", r["seg"], "→", p, flag)
