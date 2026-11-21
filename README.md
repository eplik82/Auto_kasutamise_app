# Auto kasutamise app

Offline-veebiapp (PWA) seinatahvlile: näitab, mis sõiduk on kasutuses ja mis parklas.
Töötab Androidil ja iPadil, **ei vaja Apple ID / Google kontot ega internetti** (ainult paigaldamisel).

Spetsifikatsioon: [`LÄHTEÜLESANNE.md`](LÄHTEÜLESANNE.md). Versioon: 0.2.0.

## Kasutamine
- **Roheline ruut** – auto parklas (E = ees, T = taga). Klikk → vali nimi → auto võetud (punane).
- **Kollane ruut** – broneering algab 24 h jooksul või kestab. Võtta tohib (küsib kinnitust).
- **Punane ruut** – kasutuses. Klikk → tagastamine: Ees/Taga + armatuurlaua ikoonid (klaasipesuvedelik otsas, kütust vähe).
- **🔧 Hooldus** (nimede aknas) → hoolduse poolpäevad, hoolduse ajal ruut hall.
- **❄** ruudu vasakul üleval = talverehvid (⚙ → sõiduki juures Suverehvid/Talverehvid).
- **📅 Broneeri** (nimede aknas) → nimi → poolpäevad (hommik/õhtu), kuni 21 päeva ette.
- **Täisekraan:** brauseris (nt Samsung Internet) lülitub esimesel puudutusel täisekraanile; nupp ülal paremal lülitab sisse/välja (⚙ → Täisekraan).
- **🕘** ajalugu, **☀/🌙** öö/päev, **⚙** seaded (sõidukid, inimesed, öörežiim, liikumisandur, PIN, varukoopia).

## Paigaldamine seadmesse
1. Seade Wi-Fi-sse, ava **https://eplik82.github.io/Auto_kasutamise_app/**
2. **iPad:** Safari → Jaga ⬆ → *Lisa avakuvale*. **Android:** Chrome → ⋮ → *Installi / Lisa avakuvale*.
3. Ava avakuvalt, luba kaamera (liikumisandur). Edaspidi töötab ilma internetita.
4. Seinatahvlil: iPad *Seaded → Ekraan → Automaatlukk → Mitte kunagi* (+ soovitavalt *Juurdepääs → Juhendatud
   juurdepääs*); Android *Arendaja valikud → Jää ärkvel laadimisel*.

Andmed on ainult selles seadmes (localStorage). Varukoopia: ⚙ → Ekspordi / Impordi.

## Arendus ja testimine
- Lokaalne server: `python3 -m http.server 8765` → http://localhost:8765
- Virtuaalne Android-tahvel (WSL): `bash tools/start_emulator.sh`
  (esimesel korral `sudo chmod 666 /dev/kvm`). AVD `Tahvel_test`, Android 14 + Chrome, emuleeritud esikaamera.
- Ikoonid: `python3 tools/make_icons.py icons`
- Uue versiooni avaldamisel muuda `VERSION` (app.js) ja `CACHE` (sw.js). Service worker on "võrk enne": Wi-Fi-s tõmbab alati uue, offline kasutab vahemälu.
