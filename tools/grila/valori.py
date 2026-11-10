# Valorile minime 2026 (Studiu de piață Timiș, Romprice, depus la CNP Timișoara 10.12.2025) → valori.json
# Transcriere din anexele 1–20. Ordinea coloanelor e notată în "cols".
import json
Y = ["≥2005", "1990–2004", "1965–1989", "<1965"]
YR = ["la roșu"] + Y
TM = {
  "ap_old":   {"t": "Apartamente construite înainte de 2005", "u": "euro/mp util", "cols": ["1 cam", "2 cam", "3 cam", "4+ cam"],
               "z": {"0": [2350,2150,2000,1820], "1": [1750,1650,1500,1400], "2": [1650,1500,1400,1260], "3": [1520,1360,1260,1200], "4": [1350,1250,1150,1100], "5": [1350,1250,1150,1100]}},
  "ap_new":   {"t": "Apartamente construite din 2005", "u": "euro/mp util", "cols": ["1 cam", "2 cam", "3 cam", "4+ cam"],
               "z": {"0": [2400,2300,2150,2050], "1": [2400,2300,2150,2050], "2": [2000,1850,1700,1650], "3": [1650,1600,1540,1500], "4": [1550,1500,1400,1300], "5": [1550,1500,1400,1300]}},
  "ap_casa":  {"t": "Apartamente în case apartamentate", "u": "euro/mp util", "cols": ["1 cam", "2 cam", "3 cam", "4+ cam"],
               "z": {"0": [1900,1750,1660,1600], "1": [1540,1430,1360,1300], "2": [1310,1200,1150,1100], "3": [1250,1160,1100,1050], "4": [1060,1000,950,900], "5": [1060,1000,950,900]}},
  "com":      {"t": "Spații comerciale și birouri", "u": "euro/mp util", "cols": ["comercial", "birouri"],
               "z": {"0": [1950,1900], "1": [1700,1550], "2": [1560,1320], "3": [1400,1200], "4": [1150,1050], "5": [1150,1050]}},
  "teren":    {"t": "Teren intravilan", "u": "euro/mp", "cols": ["intravilan"],
               "z": {"0": [600], "1": [340], "2": [260], "3": [180], "4": [100], "5": [50]}, "extravilan": 8},
  "hotel":    {"t": "Hoteluri", "u": "euro/mp construit desfășurat", "cols": ["2 stele", "3 stele", "4+ stele"],
               "z": {"0": [1280,1360,1500], "1": [1280,1360,1500], "2": [1210,1280,1420], "3": [1070,1130,1250], "4": [920,980,1080], "5": [920,980,1080]}},
  "pensiune": {"t": "Pensiuni", "u": "euro/mp construit desfășurat", "cols": ["2 stele", "3 stele", "4+ stele"],
               "z": {"0": [850,910,960], "1": [850,910,960], "2": [800,860,900], "3": [700,750,790], "4": [600,640,680], "5": [600,640,680]}},
  "casa_pe":  {"t": "Case P+E și P+E+M (cărămidă)", "u": "euro/mp construit desfășurat", "cols": YR, "levels": {
               "parter":   {"0": [600,1170,990,840,720], "2": [570,1110,940,800,680], "4": [510,1000,840,710,610]},
               "etaj":     {"0": [330,910,760,650,550], "2": [310,860,730,620,530], "4": [280,770,650,550,470]},
               "mansardă": {"0": [140,630,530,450,380], "2": [140,590,500,430,360], "4": [120,530,450,380,320]},
               "subsol/demisol": {"0": [450,690,580,490,420], "2": [430,650,550,470,400], "4": [390,580,490,420,360]}}},
  "casa_p":   {"t": "Case P și P+M (cărămidă)", "u": "euro/mp construit desfășurat", "cols": YR, "levels": {
               "parter":   {"0": [570,1180,990,840,720], "2": [550,1120,940,800,680], "4": [490,1000,840,720,610]},
               "mansardă": {"0": [140,630,530,450,380], "2": [140,590,500,430,360], "4": [120,530,450,380,320]},
               "subsol/demisol": {"0": [450,690,580,490,420], "2": [430,650,550,470,400], "4": [390,580,490,420,360]}}},
  "casa_lemn": {"t": "Case din paiantă, cărămidă nearsă, lemn", "u": "euro/mp construit desfășurat", "cols": Y,
               "z2": {"0": [840,670,429,258], "2": [795,640,407,246], "4": [715,570,364,220]}},
  "anexa_car": {"t": "Anexe din cărămidă", "u": "euro/mp construit desfășurat", "cols": Y,
               "z2": {"0": [235,200,145,66], "2": [225,190,138,63], "4": [200,170,123,56]}},
  "anexa_lemn": {"t": "Anexe din paiantă, lemn, cărămidă nearsă", "u": "euro/mp construit desfășurat", "cols": Y,
               "z2": {"0": [100,65,30,12], "2": [95,62,28,11], "4": [85,55,25,10]}},
  "garaj": {"t": "Garaje, parcări, poduri, uscătorii, terase, boxe", "rows": [["Garaj sub bloc", "7000 euro"], ["Garaj independent sau în baterie", "4000 euro"],
            ["Loc de parcare subterană / în clădire", "7000 euro"], ["Loc de parcare exterior", "3000 euro"], ["Pod amenajat (bloc)", "1000 euro/mp util"],
            ["Pod neamenajat (bloc)", "450 euro/mp util"], ["Uscătorie de bloc", "1350 euro/mp util"], ["Terasă de bloc", "250 euro/mp construit"], ["Boxă la subsol", "300 euro/mp util"]]},
  "industrial": {"t": "Clădiri industriale", "u": "euro/mp construit desfășurat", "cols": Y, "rows": {
            "Hală structură beton armat": [530,440,240,120], "Hală structură metalică": [450,380,250,130], "Clădiri administrative": [660,550,410,260],
            "Magazii, depozite, ateliere, posturi trafo": [350,290,190,100], "Barăci metalice": [170,130,53,21], "Șoproane, copertine": [126,90,42,17], "Platforme și drumuri betonate": [75,55,23,9]}},
  "reduceri": ["Zonele 1–3: peste 5.000 mp, suprafața în plus −30%; zonele 4–5: peste 5.000 mp −65% (și la parcele alipite în aceeași tranzacție).",
               "Drum −85%; spații verzi / interdicție permanentă de construire −70%.",
               "Apartamente: mansardă −10%, demisol/subsol locuibil −30%. Spații comerciale: peste 200 mp −20% pe diferență; mansardă −10%, subsol −30%; restaurante, spitale, cabinete, învățământ −20%; structură lemn/PVC −50%.",
               "Case: V = Vparter×Sc parter + Vetaj×Sc etaj + Vmansardă×Sc mansardă + Vsubsol×Sc subsol; fundație = 15% din parter; terenul se adaugă după zonă."],
}
# Localitățile din circumscripția Timișoara (anexele 12–20)
GRUP = {
  "A": ["Jimbolia","Chișoda","Dumbrăvița","Giarmata","Giarmata Vii","Ghiroda","Giroc","Moșnița Nouă","Moșnița Veche","Recaș","Remetea Mare","Săcălaz","Sânandrei","Șag"],
  "B": ["Albina","Bazoșu Nou","Becicherecu Mic","Beregsău Mare","Biled","Bucovăț","Cărpiniș","Cerneteaz","Chevereșu Mare","Covaci","Dudeștii Noi","Izvin","Orțișoara","Parța","Peciu Nou","Pișchia","Rudicica","Sacoșu Turcesc","Sânmihaiu Român","Urseni","Utvin"],
  "C": ["Alioș","Altringen","Bazoș","Bărăteaz","Bencecu de Jos","Bencecu de Sus","Beregsău Mic","Berini","Bobda","Bogda","Buzad","Carani","Călacea","Cenei","Charlottenburg","Checea","Comeat","Cornești","Crai Nou","Cruceni","Diniaș","Dragșina","Fibiș","Foeni","Giulvăz","Herneacova","Hodoni","Ianova","Icloda","Iecea Mare","Iecea Mică","Iohanisfeld","Ivanda","Mașloc","Murani","Nadăș","Otelec","Otvești","Petrovaselo","Pustiniș","Răuți","Remetea Mică","Rudna","Salcia Nouă","Satchinez","Sânmartinu Maghiar","Sânmartinu Sârbesc","Sânmihaiu German","Seceani","Sintar","Stamora Română","Stanciova","Șandra","Uihei","Uivar","Uliuc","Unip","Vucova"]}
LOC = {
  "ap_new": {"t": "Apartamente construite din 2000", "u": "euro/mp util", "cols": ["1 cam","2 cam","3 cam","4+ cam"], "by": {
      "Dumbrăvița": {"A": [1700,1670,1550,1480], "B": [1650,1600,1500,1420], "C": [1570,1500,1450,1300], "D": [1570,1500,1450,1300], "E": [1570,1500,1450,1300]},
      "Giroc": {"A": [1700,1600,1530,1450], "B": [1600,1500,1450,1370], "C": [1450,1400,1330,1250], "D": [1450,1400,1330,1250]},
      "Chișoda": [1400,1350,1300,1250], "Ghiroda": [1400,1350,1300,1250], "Moșnița Nouă": [1400,1350,1300,1250], "Moșnița Veche": [1400,1350,1300,1250],
      "Giarmata": [1300,1200,1160,1110], "Giarmata Vii": [1300,1200,1160,1110], "Săcălaz": [1300,1200,1160,1110], "Sânandrei": [1300,1200,1160,1110], "Utvin": [1300,1200,1160,1110],
      "*": [950,900,950,800]}},
  "ap_old": {"t": "Apartamente construite înainte de 2000", "u": "euro/mp util", "cols": ["1 cam","2 cam","3 cam","4+ cam"], "by": {
      "Dumbrăvița": [1100,1050,950,930], "Giroc": [1100,1050,950,930], "Chișoda": [1100,1050,950,930], "Ghiroda": [1100,1050,950,930], "Moșnița Nouă": [1100,1050,950,930], "Moșnița Veche": [1100,1050,950,930],
      "Jimbolia": [650,610,560,480], "*": [500,520,450,360]}},
  "garaj": {"t": "Garaje, parcări, boxe construite din 2000", "rows": [["Garaj", "3200 euro"], ["Parcare subterană", "5500 euro"], ["Parcare supraterană", "3000 euro"], ["Pod amenajat", "750 euro/mp util"], ["Pod neamenajat", "350 euro/mp util"], ["Boxă", "250 euro/mp"]]},
  "com_new": {"t": "Spații comerciale construite din 2000", "u": "euro/mp util", "by": {"Dumbrăvița": 1500, "Giroc": 1500, "Chișoda": 1350, "Ghiroda": 1350, "Moșnița Nouă": 1350, "Moșnița Veche": 1350, "*": 1050}},
  "com_old": {"t": "Spații comerciale construite înainte de 2000", "u": "euro/mp util", "grup": {"A": 800, "B": 550, "C": 400}},
  "teren": {"t": "Teren intravilan", "u": "euro/mp", "by": {
      "Jimbolia": {"A": 38, "B": 15}, "Recaș": 20, "Bazoș": 10, "Izvin": 20, "Herneacova": 13, "Nadăș": 5, "Petrovaselo": 7, "Stanciova": 5, "Becicherecu Mic": 30, "Biled": 22,
      "Bogda": 6, "Altringen": 5, "Buzad": 5, "Charlottenburg": 8, "Comeat": 3, "Sintar": 3, "Bucovăț": 28, "Bazoșu Nou": 23, "Cărpiniș": 16, "Iecea Mică": 7,
      "Cenei": 7, "Bobda": 6, "Checea": 6, "Chevereșu Mare": 11, "Dragșina": 22, "Vucova": 5, "Dudeștii Noi": {"A": 50, "B": 35, "C": 15},
      "Dumbrăvița": {"A": 185, "B": 135, "C": 95, "D": 55, "E": 35}, "Fibiș": 8, "Foeni": 4, "Cruceni": 3, "Ghiroda": {"A": 100, "B": 55, "C": 30}, "Giarmata Vii": 45,
      "Giarmata": 40, "Cerneteaz": 35, "Giroc": {"A": 140, "B": 95, "C": 50, "D": 30}, "Chișoda": {"A": 130, "B": 85, "C": 40}, "Giulvăz": 8, "Crai Nou": 3, "Ivanda": 3, "Rudna": 3,
      "Iecea Mare": 9, "Mașloc": 8, "Alioș": 5, "Remetea Mică": 3, "Moșnița Nouă": {"A": 120, "B": 95, "C": 75, "D": 45}, "Albina": 25,
      "Moșnița Veche": {"A": 95, "B": 75, "C": 45, "D": 25}, "Rudicica": 45, "Urseni": {"A": 70, "B": 75, "C": 45, "D": 25}, "Orțișoara": 25, "Călacea": 9, "Cornești": 12, "Seceani": 6,
      "Otelec": 5, "Parța": 25, "Peciu Nou": 17, "Diniaș": 9, "Sânmartinu Sârbesc": 7,
      "Pișchia": 20, "Bencecu de Jos": 7, "Bencecu de Sus": 7, "Murani": 8, "Sălciua Nouă": 5, "Remetea Mare": 33, "Ianova": 16, "Sacoșu Turcesc": 11, "Berini": 6, "Icloda": 6,
      "Otvești": 6, "Stamora Română": 6, "Uliuc": 7, "Unip": 5, "Satchinez": 9, "Bărăteaz": 6, "Hodoni": 6, "Săcălaz": {"A": 100, "B": 75, "C": 40, "D": 12},
      "Beregsău Mare": 18, "Beregsău Mic": 7, "Sânandrei": {"A": 65, "B": 45, "C": 30}, "Carani": 18, "Covaci": 35, "Sânmihaiu Român": 45, "Sânmihaiu German": 18, "Utvin": 50,
      "Șag": {"A": 75, "B": 60, "C": 30}, "Șandra": 10, "Uihei": 4, "Uivar": 5, "Ionel (Iohanisfeld)": 4, "Pustiniș": 4, "Răuți": 2, "Sânmartinu Maghiar": 3},
    "note": "Peste 3.000 mp: zonele A–B −20% pe diferență; fără zonare sau zonele C–E −80%. Drum −85%, spații verzi −70%."},
  "extravilan": {"t": "Teren extravilan (arabil)", "u": "euro/ha", "by": {
      "Jimbolia": 9000, "Recaș": 8000, "Izvin": 8000, "Bazoș": 7500, "Herneacova": 7500, "Nadăș": 6000, "Petrovaselo": 6500, "Stanciova": 6000, "Becicherecu Mic": 8500, "Biled": 8500,
      "Bogda": 6000, "Altringen": 6000, "Buzad": 6000, "Charlottenburg": 6000, "Comeat": 6000, "Sintar": 6000, "Bucovăț": 8000, "Bazoșu Nou": 8000, "Cărpiniș": 9000, "Iecea Mică": 9000,
      "Cenei": 8000, "Bobda": 8000, "Checea": 8500, "Chevereșu Mare": 7000, "Dragșina": 7000, "Vucova": 6500, "Dudeștii Noi": 9000, "Dumbrăvița": 70000, "Fibiș": 7000, "Foeni": 7000,
      "Cruceni": 7000, "Ghiroda": 40000, "Giarmata Vii": 40000, "Giarmata": 10000, "Cerneteaz": 8500, "Giroc": 25000, "Chișoda": 25000, "Giulvăz": 7000, "Crai Nou": 6500, "Ivanda": 7000,
      "Rudna": 6500, "Iecea Mare": 9000, "Mașloc": 7000, "Alioș": 6000, "Remetea Mică": 6000, "Moșnița Nouă": 30000, "Albina": 15000, "Moșnița Veche": 30000, "Rudicica": 20000, "Urseni": 20000,
      "Orțișoara": 8000, "Călacea": 8000, "Cornești": 8000, "Seceani": 8000, "Otelec": 6500, "Ionel (Iohanisfeld)": 6500, "Parța": 8000, "Peciu Nou": 8000, "Diniaș": 7000, "Sânmartinu Sârbesc": 7000,
      "Pișchia": 8000, "Bencecu de Jos": 8000, "Bencecu de Sus": 8000, "Murani": 7500, "Sălciua Nouă": 6500, "Remetea Mare": 8000, "Ianova": 8000, "Sacoșu Turcesc": 7500, "Berini": 7500, "Icloda": 7500,
      "Otvești": 7500, "Stamora Română": 7500, "Uliuc": 7500, "Unip": 7500, "Satchinez": 8000, "Bărăteaz": 8000, "Hodoni": 8000, "Săcălaz": 8500, "Beregsău Mare": 8500, "Beregsău Mic": 8500,
      "Sânandrei": 8500, "Carani": 8500, "Covaci": 8500, "Sânmihaiu Român": 8000, "Sânmihaiu German": 8000, "Utvin": 8000, "Șag": 9500, "Șandra": 8500, "Uihei": 8500, "Uivar": 6500,
      "Pustiniș": 6500, "Răuți": 6500, "Sânmartinu Maghiar": 6500},
    "cat": {"Pășuni, fânețe": "90% din arabil", "Livezi, vii, păduri": "150%", "Curți construcții": "200%", "Neproductiv, drum": "60%", "Heleștee": "200%"},
    "note": "Moșnița Nouă și Urseni, zona râului Timiș: peste 2 ha −50% pe diferență."},
  "hotel": {"t": "Hoteluri", "u": "euro/mp construit desfășurat", "cols": ["2 stele","3 stele","4+ stele"], "grup": {"A": [990,1060,1170], "B": [710,750,830], "C": [640,680,750]}},
  "pensiune": {"t": "Pensiuni", "u": "euro/mp construit desfășurat", "cols": ["2 stele","3 stele","4+ stele"], "grup": {"A": [700,750,790], "B": [500,540,560], "C": [450,480,510]}},
  "casa_pe": {"t": "Case P+M, P+E, P+E+M (cărămidă)", "u": "euro/mp construit desfășurat", "cols": YR, "grup": {"A": [420,960,760,540,340], "B": [300,700,550,390,240], "C": [260,590,470,330,200]}},
  "casa_p": {"t": "Case P (cărămidă)", "u": "euro/mp construit desfășurat", "cols": YR, "grup": {"A": [520,1060,840,590,370], "B": [370,770,610,430,270], "C": [320,650,510,360,230]}},
  "casa_lemn": {"t": "Case din paiantă, cărămidă nearsă, lemn", "u": "euro/mp construit desfășurat", "cols": Y, "grup": {"A": [715,585,390,227], "B": [515,425,280,164], "C": [435,360,240,138]}},
  "anexa_car": {"t": "Anexe din cărămidă", "u": "euro/mp construit desfășurat", "cols": Y, "grup": {"A": [190,160,105,42], "B": [150,125,83,33], "C": [130,110,72,29]}},
  "anexa_lemn": {"t": "Anexe din paiantă, lemn", "u": "euro/mp construit desfășurat", "cols": Y, "grup": {"A": [80,50,24,9], "B": [65,40,19,8], "C": [55,35,16,7]}},
  "industrial": {"t": "Clădiri industriale", "u": "euro/mp construit desfășurat", "cols": Y, "rows": ["Hală structură beton armat","Hală structură metalică","Clădiri administrative","Magazii, depozite, ateliere, post trafo","Barăci metalice","Șoproane, copertine","Platforme betonate"], "grup": {
      "A": [[440,360,190,110],[380,310,200,110],[550,460,330,200],[290,240,130,73],[141,103,47,19],[112,82,37,15],[61,45,20,8]],
      "B": [[350,290,160,90],[300,250,160,90],[440,360,260,160],[230,190,102,58],[113,85,38,15],[89,65,30,12],[50,36,16,6]],
      "C": [[290,240,130,70],[250,210,130,70],[370,300,220,130],[190,160,80,49],[94,69,31,13],[74,55,25,10],[41,30,14,5]]}},
  "grajd": {"t": "Grajduri", "u": "euro/mp construit desfășurat", "cols": Y, "grup": {"A": [220,170,56,25], "B": [195,145,49,22], "C": [170,125,42,19]}},
  "magazie": {"t": "Magazii cereale", "u": "euro/mp construit desfășurat", "cols": Y, "grup": {"A": [290,220,119,51], "B": [250,190,102,44], "C": [205,158,85,36]}},
  "note": "Case în localități: mansardă, demisol, subsol = 50% din valoarea tabelului; fundație 15% din parter; terenul se adaugă."
}
out = {"sursa": "Studiu de piață privind valorile minime ale imobilelor din județul Timiș – 2026 (Romprice, CNP Timișoara nr. 4100/10.12.2025)", "an": 2026,
       "timisoara": TM, "grup": GRUP, "localitati": LOC}
json.dump(out, open("valori.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok", len(json.dumps(out)))
