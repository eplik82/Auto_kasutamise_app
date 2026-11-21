# Lähteülesanne – Auto kasutamise app

_Loodud 2026-11-21._

## Eesmärk (kasutaja sõnastus, 2026-11-21)
Appi eesmärk on märkida ära, mis sõiduk on hetkel kasutamises ja mis parklas.
Pealeht on ruudustik sõidukite nimedega. Ruudul klikkides avaneb üle ekraani suur
menüü inimeste nimedega. Nime valides menüü sulgub, ruut läheb punaseks ja ruudul
kuvatakse inimese nimi.

## Täpsustused
- 2026-11-21: app on **offline** ja töötab **Androidil ja iPadil**.
- 2026-11-21: lisa **broneerimise võimalus**; **1 päev enne broneeringu algust läheb ruut kollaseks**.
- 2026-11-21: **tagastamisel küsitakse, kas auto pargiti ees- või tagaparklasse**; ruudule kuvatakse täht **E** või **T**.
- 2026-11-21 vastused: 1) iga seade hoiab oma seisu; 2) punase ruudu klikk = tagastus parklasse;
  3) autode arv ja nimed muudetavad appis; 4) ajalugu piisab seadme ekraanil vaatamisest;
  5) tagastamisel ikoonid "klaasipesuvedelik otsas", "kütust vähe"; 7) broneering poole päeva kaupa
  (hommik/õhtu); 8) broneeri-nupp on nimede loetelu vaates; 9) kollast autot tohib võtta; 10) kollane kogu
  broneeringu aja.
- 2026-11-21: lisa **öö/päeva vaade**; kasuta **esikaamerat liikumisandurina**.
- 2026-11-21 vastused: 15) ruumi valguse mõõtmine seadetesse; 16) jah, uinumine/ärkamine liikumisel;
  17) **vanemad seadmed**, kogu aeg seinas (laadijas).
- 2026-11-21: 18) mudeleid hetkel ei tea. **iPadidel pole iCloud/Apple ID kontot** → PWA (ei vaja kontot ega App Store'i).

## Spetsifikatsioon (minu arusaam, 2026-11-21)

**Platvorm:** PWA (HTML+JS), offline, Android + iPad, avakuvale paigaldatav. Andmed seadme mälus,
seadmed ei sünkroniseeru.

**Pealeht – ruudustik**, üks suur ruut iga auto kohta:
- **Roheline** = parklas, vaba. Kuvab auto nime + suure tähe **E**/**T** + teavitusikoonid (🧴 klaasipesuvedelik otsas, ⛽ kütust vähe).
- **Kollane** = broneering algab ≤ 24 h pärast **või** broneering kestab ja autot pole veel võetud.
  Kuvab broneerija nime + poolpäeva (nt "R 22.11 hommik") + E/T + ikoonid.
- **Punane** = kasutuses. Kuvab võtja nime (+ väike märge, kui järgmine broneering on ≤ 24 h).

**Rohelise/kollase ruudu klikk** → täisekraani aken:
- suured nimenupud → nime valik = auto võetakse kohe → ruut punaseks + nimi;
- kollase puhul, kui võtja ≠ broneerija → hoiatus "Broneeritud: X, hommik 22.11 – võtad ikkagi?";
- nupp **"Broneeri"** → nimi → kuupäev → **Hommik / Õhtu / Terve päev** (võib valida mitu järjestikust poolpäeva);
  kattuvat broneeringut ei lubata;
- sama akna all selle auto broneeringute nimekiri (tühistamine).

**Punase ruudu klikk** → tagastamine, täisekraani aken:
- **"Ees (E)" / "Taga (T)"** + lülitatavad ikoonid **🧴 Klaasipesuvedelik otsas**, **⛽ Kütust vähe** → "Tagasta";
- ruut roheliseks (või kollaseks, kui broneering), E/T ja valitud ikoonid nähtavale;
- ikoonid püsivad, kuni järgmine tagastaja need maha võtab (tagastusaknas eelvalitud eelmise seisuga).

**Seaded** (⚙ nupp, PIN-kaitse eeldusena): autode lisamine/ümbernimetamine/kustutamine/järjestus,
inimeste nimekiri, poolpäevade kellaajad (eeldus: hommik 00–12, õhtu 12–24).

**Ajalugu** (ekraanil vaatamiseks): kes, mis auto, võetud/tagastatud aeg, E/T, ikoonid; filtreeritav auto järgi.

**Öö/päeva vaade:**
- Päevavaade = hele taust; öövaade = tume taust, tuhmid värvid (punane/kollane/roheline jäävad eristatavaks).
- Seadetes režiim: **Kellaaeg** (öö 21:00–07:00, muudetav) / **Ruumi valgus** (esikaamera kaadri keskmine
  heledus, lävi seadetes liuguriga + "mõõda praegu" nupp, hüsterees et ei vilguks) / käsitsi ☀/🌙.
- Valguse mõõtmine sama kaamera voost mis liikumisandur. NB: kaamera automaatsäritus tasandab heledust,
  mõõtmine on ligikaudne (pime/valge ruum eristub, hämarus vähem täpselt).

**Esikaamera liikumisandurina** (seade on seina-/lauatahvel, ekraan alati sees):
- App hoiab ekraani ärkvel (Wake Lock). Kui X minutit (eeldus 2 min) liikumist pole → ekraan läheb
  **mustaks/väga tumedaks** ("uni"). Esikaamera võrdleb ~2 korda sekundis väikese eraldusvõimega kaadreid;
  piisav muutus = liikumine → ekraan ärkab kohe.
- Pilti ei salvestata ega saadeta kuhugi, töötlus ainult seadmes.
- Seadetes: liikumisandur sees/väljas, tundlikkus, uinumise aeg.
- **Piirangud:** veebiapp ei saa ekraani päriselt välja lülitada – ainult mustaks teha (OLED-il ≈ väljas,
  LCD-l taustvalgus jääb põlema minimaalse heledusega, mida app muuta ei saa). Kaamera töötab ainult siis,
  kui app on esiplaanil; esimesel käivitusel küsib seade kaameraluba; iPadil/Androidil põleb kaamera
  kasutuse märgutuli (roheline täpp). Pidev kaamera kulutab akut → seade peaks olema laadijas.

**Paigaldamine (ilma Apple ID / Google kontota):**
1. Seade Wi-Fi-sse (ainult paigaldamise ajaks).
2. iPad: Safari → app'i aadress → Jaga ⬆ → "Lisa avakuvale". Android: Chrome → ⋮ → "Lisa avakuvale / Installi".
3. Avada üks kord avakuvalt → kõik failid salvestuvad seadmesse → edaspidi töötab ilma internetita.
4. Uuendamine: seade korraks Wi-Fi-sse → app tõmbab uue versiooni ise.
- Aadress peab olema **HTTPS** (muidu offline ei tööta): GitHub Pages või NAS (Web Station + olemasolev
  sertifikaat). Andmed jäävad seadmesse ka siis, kui server hiljem kaob.
- iOS < 11.3: offline-tugi puudub (ainult internetiga). Avakuvale lisatud PWA-d iOS ei kustuta (7 päeva reegel
  kehtib ainult Safari vahekaartidele).

**Vanad seadmed – ühilduvus:**
- Kood lihtne, ilma raamistiketa, toetab vanu brausereid (ES2015, ilma uuemate CSS-iga).
- Ekraani ärkvel hoidmine: Wake Lock API, vana seadme puhul varulahendus (vaikne video tsükkel) –
  lisaks soovitus seadme seadetes "ekraan ei lülitu välja / Guided Access / kioskirežiim".
- **iPad:** kaamera avakuvalt käivitatud PWA-s töötab alates iOS 13.4; vanemal iOS-il kaamerat ei saa →
  liikumisandur/valguse mõõtmine ei tööta, ülejäänud app töötab.
- **Android:** vaja Chrome'i, mis toetab kaamerat (Android 5+ praktiliselt OK).
- Kaamerata seadmel / loata: liikumisandur välja, öövaade kellaaja järgi, uinumine puudutusega äratamisega.

**Broneering aegub** automaatselt pärast poolpäeva lõppu, kui autot ei võetud.

## Lahtised küsimused
11. Kas punasel ruudul peaks viimane koht (E/T) olema näha? (eeldus: ei)
12. Kas parklaid võib tulla rohkem kui kaks? (eeldus: ei, ainult E/T)
13. Kas seaded kaitsta PIN-koodiga? (eeldus: jah, 4-kohaline)
14. Kas poolpäevade piir 12:00 sobib? (mõjutab, millal ruut kollaseks läheb: 24 h enne poolpäeva algust)

~~15.~~ vastatud. ~~16.~~ vastatud.
18. Palun seadmete mudelid ja OS-i versioonid (iPad: Seaded → Üldine → Teave; Android: Seaded → Teave telefonist),
    et kontrollida kaamera ja ekraani ärkvel hoidmise tuge.

15. (vana) Öövaade: kas vahetus kellaaja järgi (21–07) sobib või kasutada kaamera järgi ruumi valgust?
16. Liikumisanduri mõte – kas ekraan uinub ja ärkab liikumisel (minu eeldus) või midagi muud
    (nt öövaade lülitub liikumisel päevavaateks)?
17. Mis seadmed täpsemalt (iPadi mudel / Androidi tahvel)? Kas need on laadijas seinal?

## Ülesanded
| # | Kuupäev | Ülesanne | Staatus |
|---|---------|----------|---------|
| 1 | 2026-11-21 | Projekt loodud | tehtud |
| 2 | 2026-11-21 | Pealeht: sõidukite ruudustik, klikk → täisekraani nimevalik → ruut punaseks + nimi | ootab luba |
| 3 | 2026-11-21 | Broneerimine; 1 päev enne algust ruut kollaseks | ootab luba |
| 4 | 2026-11-21 | Tagastamisel küsimus ees/taga parklas; ruudule täht E või T | ootab luba |
| 5 | 2026-11-21 | Tagastamisel ikoonid "klaasipesuvedelik otsas", "kütust vähe" | ootab luba |
| 6 | 2026-11-21 | Öö/päeva vaade (kellaaeg / ruumi valgus kaameraga); esikaamera liikumisandurina (ekraani uinumine/ärkamine); toetus vanadele seadmetele | ootab luba |
