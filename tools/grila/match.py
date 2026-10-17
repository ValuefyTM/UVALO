# Potrivirea numelor de străzi din anexe cu numele OSM (pe jetoane normalizate, fără titluri/diacritice).
import re, unicodedata
TYPE_W = {"strada","str","bulevardul","bd","bulevard","calea","cale","aleea","alee","intrarea","intr","piata","pta","p-ta","splaiul","splai","scuarul","scuar","drumul","soseaua","sos"}
TITLE_W = {"doctor","dr","profesor","prof","martir","general","gen","maresal","academician","acad","episcop","mitropolit","protopop","arhitect","arh",
           "locotenent","lt","colonel","col","sergent","sgt","patriarh","preot","pr","sublocotenent","slt","arhimandrit","capitan","cpt","maior","inginer","ing","martirii"}
def strip(s):
    s = unicodedata.normalize("NFKD", s); s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower()
def tokens(s, drop_titles=True):
    s = strip(s).replace("-", " ").replace("'", " ").replace("’", " ").replace(".", " ")
    s = re.sub(r"\((.*?)\)", " ", s)
    t = [w for w in re.split(r"[^a-z0-9]+", s) if w]
    t = [w for w in t if w not in TYPE_W]
    if drop_titles: t = [w for w in t if w not in TITLE_W]
    t = [w for w in t if not (len(w) == 1 and w.isalpha())]   # inițiale (Grigore T. Popa)
    # variante uzuale
    rep = {"sfantul": "sf", "sfanta": "sf", "sfintii": "sf", "sfantului": "sf", "sfintei": "sf", "sfintele": "sf", "sfinti": "sf", "sfanti": "sf",
           # prenume scrise diferit în anexe și în OSM
           "ioan": "ion", "petre": "petru", "george": "gheorghe", "georg": "gheorghe", "georges": "gheorghe", "iosif": "joseph", "ioseph": "joseph", "josef": "joseph",
           "iosef": "joseph", "nicolaus": "nicolae", "nikolaus": "nicolae", "mihail": "mihai", "istvan": "stefan", "c": "constantin", "tin": "constantin", "ctin": "constantin",
           "teodor": "theodor", "wiliam": "wilhelm", "william": "wilhelm", "jozsef": "joszef", "janos": "ianos", "henrich": "heinrich", "edvard": "eduard", "simeon": "simion",
           "iovan": "jovan", "ivanovici": "iovanovici", "emanuil": "emanoil", "alexandru": "alexandru", "johny": "johnny", "henrieta": "henriette"}
    return [rep.get(w, w) for w in t]
def key(tokens): return " ".join(sorted(set(tokens)))
def annex_tokens(rec):
    s = " ".join(x for x in [rec.get("name", ""), rec.get("given", "")] if x)
    return tokens(s)
def score(a, b):
    """0..1: a = jetoanele din anexă, b = din OSM. 1 = aceleași; altfel Jaccard, cu prefixe comune (Lazar/Lazarescu nu)."""
    A, B = set(a), set(b)
    if not A or not B: return 0
    if A == B: return 1
    inter = len(A & B); return inter / len(A | B)
