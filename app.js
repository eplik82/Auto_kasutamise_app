/* Auto kasutamise app – offline PWA
 * Kirjutatud lihtsas ES2015-s (ilma raamistiketa), et töötaks vanadel iPadidel/Androididel.
 * Andmed: localStorage (ainult selles seadmes).
 */
(function () {
  'use strict';

  var VERSION = '0.1.1';
  var KEY = 'autoapp.v1';
  var DAY_MS = 24 * 3600 * 1000;
  var WEEKDAYS = ['P', 'E', 'T', 'K', 'N', 'R', 'L'];
  var BOOK_DAYS = 21; // mitu päeva ette saab broneerida

  // ---------- Andmed ----------
  function defaults() {
    return {
      cars: [
        { id: uid(), name: 'Auto 1', spot: 'E', washer: false, fuel: false, user: null, takenAt: 0 },
        { id: uid(), name: 'Auto 2', spot: 'E', washer: false, fuel: false, user: null, takenAt: 0 },
        { id: uid(), name: 'Auto 3', spot: 'T', washer: false, fuel: false, user: null, takenAt: 0 }
      ],
      people: [],
      bookings: [], // {id, carId, person, date:'YYYY-MM-DD', half:'H'|'O'}
      history: [],  // {carName, person, takenAt, returnedAt, spot, washer, fuel}
      settings: {
        pin: '',
        themeMode: 'time',     // time | light | day | night
        nightFrom: '21:00', nightTo: '07:00',
        lightThreshold: 40,    // 0..255 keskmine heledus
        motion: true, sensitivity: 50, sleepMin: 2,
        halfSplit: 12          // hommik 00–12, õhtu 12–24
      }
    };
  }
  var db = load();

  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    var def = defaults();
    if (!d || !d.cars) return def;
    d.settings = Object.assign(def.settings, d.settings || {});
    d.people = d.people || []; d.bookings = d.bookings || []; d.history = d.history || [];
    return d;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alert('Salvestamine ebaõnnestus: ' + e.message); }
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function carById(id) { for (var i = 0; i < db.cars.length; i++) if (db.cars[i].id === id) return db.cars[i]; return null; }

  // ---------- Aeg ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function hm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dayLabel(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + '.' + (d.getMonth() + 1); }
  function fullTime(t) { var d = new Date(t); return dayLabel(d) + ' ' + hm(t); }
  function halfName(h) { return h === 'H' ? 'hommik' : 'õhtu'; }
  function slotStart(b) {
    var d = parseYmd(b.date);
    if (b.half === 'O') d.setHours(db.settings.halfSplit);
    return d.getTime();
  }
  function slotEnd(b) {
    var d = parseYmd(b.date);
    if (b.half === 'H') d.setHours(db.settings.halfSplit); else d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  function bookingLabel(b) {
    var d = parseYmd(b.date), today = ymd(new Date()), tom = ymd(new Date(Date.now() + DAY_MS));
    var day = b.date === today ? 'täna' : (b.date === tom ? 'homme' : dayLabel(d));
    return day + ' ' + halfName(b.half);
  }

  // ---------- Broneeringud ----------
  function purgeBookings() {
    var now = Date.now(), n = db.bookings.length;
    db.bookings = db.bookings.filter(function (b) { return slotEnd(b) > now && carById(b.carId); });
    if (db.bookings.length !== n) save();
  }
  function carBookings(carId) {
    return db.bookings.filter(function (b) { return b.carId === carId; })
      .sort(function (a, b) { return slotStart(a) - slotStart(b); });
  }
  // Lähim broneering, mis algab ≤ 24 h pärast või juba kestab
  function soonBooking(carId) {
    var now = Date.now(), list = carBookings(carId);
    for (var i = 0; i < list.length; i++) {
      if (slotStart(list[i]) - now <= DAY_MS && slotEnd(list[i]) > now) return list[i];
    }
    return null;
  }
  function findBooking(carId, date, half) {
    for (var i = 0; i < db.bookings.length; i++) {
      var b = db.bookings[i];
      if (b.carId === carId && b.date === date && b.half === half) return b;
    }
    return null;
  }

  // ---------- Armatuurlaua ikoonid (SVG) ----------
  var ICONS = {
    // klaasipesuvedelik: tuuleklaas + pritsiv juga (ISO 2575 stiil)
    washer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M2.5 7.5 Q12 3 21.5 7.5 L19.5 20 H4.5 Z"/>' +
      '<path d="M12 19 V13" stroke-dasharray="1.6 1.9"/>' +
      '<path d="M12 19 Q11.5 13 7 10.5" stroke-dasharray="1.6 1.9"/>' +
      '<path d="M12 19 Q12.5 13 17 10.5" stroke-dasharray="1.6 1.9"/></svg>',
    // kütus: tanur
    fuel: '<svg viewBox="0 0 24 24" fill="currentColor">' +
      '<path fill-rule="evenodd" d="M4 4.5 A1.5 1.5 0 0 1 5.5 3 H12.5 A1.5 1.5 0 0 1 14 4.5 V20 H4 Z M6 5.5 V10 H12 V5.5 Z"/>' +
      '<rect x="2.5" y="20" width="13" height="2" rx=".5"/>' +
      '<path d="M14 9 H15.5 A1.5 1.5 0 0 1 17 10.5 V16.5 A1.5 1.5 0 0 0 20 16.5 V8.5 L17.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  var ICON_TITLE = { washer: 'Klaasipesuvedelik otsas', fuel: 'Kütust vähe' };
  function lamp(name) { return '<span class="lamp" title="' + ICON_TITLE[name] + '">' + ICONS[name] + '</span>'; }
  function lamps(o) { return (o.washer ? lamp('washer') : '') + (o.fuel ? lamp('fuel') : ''); }

  // ---------- Pealeht ----------
  var grid = document.getElementById('grid');
  function render() {
    purgeBookings();
    var html = '';
    var n = db.cars.length, cls = n <= 4 ? 'cols2' : (n >= 10 ? 'cols4' : '');
    if (!n) html = '<div class="empty">Sõidukeid pole. Lisa need seadetes ⚙.</div>';
    db.cars.forEach(function (c) {
      var sb = soonBooking(c.id), state = c.user ? 'red' : (sb ? 'yellow' : 'green');
      var flags = lamps(c);
      html += '<div class="tile ' + state + ' ' + cls + '" data-id="' + c.id + '">';
      if (state !== 'red') html += '<div class="spot">' + c.spot + '</div>';
      html += '<div class="name">' + esc(c.name) + '</div>';
      if (state === 'red') {
        html += '<div class="who">' + esc(c.user) + '</div><div class="sub">alates ' + (sameDay(c.takenAt) ? hm(c.takenAt) : fullTime(c.takenAt)) + '</div>';
        if (sb) html += '<div class="note">📅 ' + esc(sb.person) + ' ' + bookingLabel(sb) + '</div>';
      } else if (state === 'yellow') {
        html += '<div class="who">📅 ' + esc(sb.person) + '</div><div class="sub">' + bookingLabel(sb) + '</div>';
      }
      if (flags) html += '<div class="flags">' + flags + '</div>';
      html += '</div>';
    });
    grid.innerHTML = html;
  }
  function sameDay(t) { return ymd(new Date(t)) === ymd(new Date()); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  grid.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== grid && !(t.className && /\btile\b/.test(t.className))) t = t.parentNode;
    if (!t || t === grid) return;
    var car = carById(t.getAttribute('data-id'));
    if (!car) return;
    if (car.user) showReturn(car); else showTake(car);
  });

  // ---------- Ülekate (dialoogid) ----------
  var overlay = document.getElementById('overlay');
  var onClose = null;
  function openDialog(html, small) {
    overlay.innerHTML = '<div class="dialog' + (small ? ' small' : '') + '">' + html + '</div>';
    overlay.classList.remove('hidden');
    return overlay.firstChild;
  }
  function closeDialog() {
    overlay.classList.add('hidden'); overlay.innerHTML = '';
    var f = onClose; onClose = null; if (f) f();
    render();
  }
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeDialog(); });
  function on(root, sel, ev, fn) {
    var els = root.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) els[i].addEventListener(ev, fn);
  }
  function confirmBox(text, okText, fn, okClass) {
    var d = openDialog('<h2>' + text + '</h2><div class="actions"><button data-a="no">Ei</button>' +
      '<button data-a="yes" class="' + (okClass || 'primary') + '">' + okText + '</button></div>', true);
    on(d, '[data-a=no]', 'click', closeDialog);
    on(d, '[data-a=yes]', 'click', function () { fn(); });
  }

  // Võtmine: nimede loetelu + Broneeri nupp + selle auto broneeringud
  function showTake(car) {
    var sb = soonBooking(car.id);
    var h = '<h2>' + esc(car.name) + ' – kes võtab?</h2>';
    if (sb) h += '<p class="info">📅 Broneeritud: <b>' + esc(sb.person) + '</b>, ' + bookingLabel(sb) + '</p>';
    else h += '<p class="info">Auto on parklas: <b>' + (car.spot === 'E' ? 'ees' : 'taga') + '</b></p>';
    if (!db.people.length) h += '<p class="info">Inimesi pole. Lisa need seadetes ⚙.</p>';
    h += '<div class="btngrid">';
    db.people.forEach(function (p, i) {
      h += '<button data-p="' + i + '"' + (sb && sb.person === p ? ' class="booker"' : '') + '>' + esc(p) + '</button>';
    });
    h += '</div>';
    var list = carBookings(car.id);
    if (list.length) {
      h += '<h3>Broneeringud</h3><ul class="list">';
      list.forEach(function (b) {
        h += '<li><span class="grow">' + esc(b.person) + ' – ' + bookingLabel(b) + '</span><button data-del="' + b.id + '" class="danger">Tühista</button></li>';
      });
      h += '</ul>';
    }
    h += '<div class="actions"><button class="left warn" data-a="book">📅 Broneeri</button><button data-a="close">Sulge</button></div>';
    var d = openDialog(h);
    on(d, '[data-a=close]', 'click', closeDialog);
    on(d, '[data-a=book]', 'click', function () { showBookPerson(car); });
    on(d, '[data-p]', 'click', function () {
      var person = db.people[+this.getAttribute('data-p')];
      if (sb && sb.person !== person) {
        confirmBox('Auto on broneeritud: ' + esc(sb.person) + ', ' + bookingLabel(sb) + '. Kas ' + esc(person) + ' võtab ikkagi?',
          'Võtan', function () { take(car, person); }, 'warn');
      } else take(car, person);
    });
    on(d, '[data-del]', 'click', function () {
      var id = this.getAttribute('data-del');
      confirmBox('Tühistan broneeringu?', 'Tühista', function () {
        db.bookings = db.bookings.filter(function (b) { return b.id !== id; });
        save(); showTake(car);
      }, 'danger');
    });
  }
  function take(car, person) {
    car.user = person; car.takenAt = Date.now();
    // Võtja enda praegu kestvad broneeringud on kasutatud
    var now = Date.now();
    db.bookings = db.bookings.filter(function (b) {
      return !(b.carId === car.id && b.person === person && slotStart(b) <= now);
    });
    save(); closeDialog();
  }

  // Tagastamine: ees/taga + ikoonid
  function showReturn(car) {
    var spot = car.spot, washer = car.washer, fuel = car.fuel;
    var h = '<h2>' + esc(car.name) + ' – tagastamine</h2>' +
      '<p class="info">Võttis <b>' + esc(car.user) + '</b>, ' + fullTime(car.takenAt) + '</p>' +
      '<h3>Kuhu parkisid?</h3><div class="btngrid two">' +
      '<button data-s="E">Ees (E)</button><button data-s="T">Taga (T)</button></div>' +
      '<h3>Märkused</h3><div class="btngrid two">' +
      '<button class="toggle" data-f="washer" aria-label="' + ICON_TITLE.washer + '">' + ICONS.washer + '</button>' +
      '<button class="toggle" data-f="fuel" aria-label="' + ICON_TITLE.fuel + '">' + ICONS.fuel + '</button></div>' +
      '<div class="actions"><button data-a="close">Tühista</button><button class="primary" data-a="ok">Tagasta</button></div>';
    var d = openDialog(h);
    function upd() {
      var b = d.querySelectorAll('[data-s]');
      for (var i = 0; i < b.length; i++) b[i].className = b[i].getAttribute('data-s') === spot ? 'sel' : '';
      d.querySelector('[data-f=washer]').className = 'toggle' + (washer ? ' on' : '');
      d.querySelector('[data-f=fuel]').className = 'toggle' + (fuel ? ' on' : '');
    }
    upd();
    on(d, '[data-s]', 'click', function () { spot = this.getAttribute('data-s'); upd(); });
    on(d, '[data-f]', 'click', function () {
      if (this.getAttribute('data-f') === 'washer') washer = !washer; else fuel = !fuel; upd();
    });
    on(d, '[data-a=close]', 'click', closeDialog);
    on(d, '[data-a=ok]', 'click', function () {
      db.history.unshift({ carName: car.name, person: car.user, takenAt: car.takenAt, returnedAt: Date.now(), spot: spot, washer: washer, fuel: fuel });
      if (db.history.length > 1000) db.history.length = 1000;
      car.user = null; car.takenAt = 0; car.spot = spot; car.washer = washer; car.fuel = fuel;
      save(); closeDialog();
    });
  }

  // Broneerimine: 1) nimi 2) päevad × hommik/õhtu
  function showBookPerson(car) {
    var h = '<h2>' + esc(car.name) + ' – kes broneerib?</h2><div class="btngrid">';
    db.people.forEach(function (p, i) { h += '<button data-p="' + i + '">' + esc(p) + '</button>'; });
    h += '</div><div class="actions"><button data-a="back">Tagasi</button></div>';
    var d = openDialog(h);
    on(d, '[data-a=back]', 'click', function () { showTake(car); });
    on(d, '[data-p]', 'click', function () { showBookSlots(car, db.people[+this.getAttribute('data-p')]); });
  }
  function showBookSlots(car, person) {
    var picked = {}; // 'YYYY-MM-DD|H' -> true
    var now = Date.now();
    var h = '<h2>' + esc(car.name) + ' – ' + esc(person) + '</h2><p class="info">Vali poolpäevad (hommik 00–' +
      pad(db.settings.halfSplit) + ', õhtu ' + pad(db.settings.halfSplit) + '–24). Kollane = juba broneeritud.</p><table class="days">';
    for (var i = 0; i < BOOK_DAYS; i++) {
      var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
      var ds = ymd(d);
      h += '<tr><td class="d">' + (i === 0 ? 'Täna ' : (i === 1 ? 'Homme ' : '')) + dayLabel(d) + '</td>';
      ['H', 'O'].forEach(function (half) {
        var ex = findBooking(car.id, ds, half), past = slotEnd({ date: ds, half: half }) <= now;
        h += '<td><button data-k="' + ds + '|' + half + '"' + (ex ? ' class="taken" disabled' : '') + (past ? ' disabled' : '') + '>' +
          (ex ? esc(ex.person) : (half === 'H' ? 'Hommik' : 'Õhtu')) + '</button></td>';
      });
      h += '</tr>';
    }
    h += '</table><div class="actions"><button data-a="back">Tagasi</button><button class="primary" data-a="ok" disabled>Broneeri</button></div>';
    var dlg = openDialog(h);
    var okBtn = dlg.querySelector('[data-a=ok]');
    on(dlg, '[data-k]', 'click', function () {
      var k = this.getAttribute('data-k');
      if (picked[k]) delete picked[k]; else picked[k] = true;
      this.className = picked[k] ? 'sel' : '';
      okBtn.disabled = !Object.keys(picked).length;
    });
    on(dlg, '[data-a=back]', 'click', function () { showBookPerson(car); });
    on(dlg, '[data-a=ok]', 'click', function () {
      Object.keys(picked).forEach(function (k) {
        var p = k.split('|');
        if (!findBooking(car.id, p[0], p[1])) db.bookings.push({ id: uid(), carId: car.id, person: person, date: p[0], half: p[1] });
      });
      save(); showTake(car);
    });
  }

  // ---------- Ajalugu ----------
  function showHistory(filter) {
    var names = {};
    db.history.forEach(function (r) { names[r.carName] = 1; });
    var h = '<h2>Ajalugu</h2><div class="form-row seg"><button data-c=""' + (!filter ? ' class="sel"' : '') + '>Kõik</button>';
    Object.keys(names).forEach(function (n) { h += '<button data-c="' + esc(n) + '"' + (filter === n ? ' class="sel"' : '') + '>' + esc(n) + '</button>'; });
    h += '</div><table class="hist"><tr><th>Auto</th><th>Kes</th><th>Võttis</th><th>Tagastas</th><th>Koht</th><th></th></tr>';
    var rows = db.history.filter(function (r) { return !filter || r.carName === filter; }).slice(0, 300);
    rows.forEach(function (r) {
      h += '<tr><td>' + esc(r.carName) + '</td><td>' + esc(r.person) + '</td><td>' + fullTime(r.takenAt) + '</td><td>' +
        fullTime(r.returnedAt) + '</td><td>' + r.spot + '</td><td>' + lamps(r) + '</td></tr>';
    });
    if (!rows.length) h += '<tr><td colspan="6">Ajalugu on tühi.</td></tr>';
    h += '</table><div class="actions"><button data-a="close">Sulge</button></div>';
    var d = openDialog(h);
    on(d, '[data-a=close]', 'click', closeDialog);
    on(d, '[data-c]', 'click', function () { showHistory(this.getAttribute('data-c')); });
  }

  // ---------- PIN ja seaded ----------
  function withPin(fn) {
    if (!db.settings.pin) return fn();
    var entered = '';
    var h = '<h2>Sisesta PIN</h2><div class="pin" id="pinv"></div><div class="btngrid keypad">';
    [1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, 'OK'].forEach(function (k) { h += '<button data-k="' + k + '">' + k + '</button>'; });
    h += '</div><div class="actions"><button data-a="close">Tühista</button></div>';
    var d = openDialog(h, true), v = d.querySelector('#pinv');
    on(d, '[data-a=close]', 'click', closeDialog);
    on(d, '[data-k]', 'click', function () {
      var k = this.getAttribute('data-k');
      if (k === '⌫') entered = entered.slice(0, -1);
      else if (k === 'OK') { if (entered === db.settings.pin) return fn(); entered = ''; v.textContent = 'Vale PIN'; return; }
      else if (entered.length < 8) entered += k;
      v.textContent = entered.replace(/./g, '●');
    });
  }

  function showSettings() {
    var s = db.settings;
    var h = '<h2>Seaded</h2>';
    h += '<h3>Sõidukid</h3><ul class="list">';
    db.cars.forEach(function (c, i) {
      h += '<li><span class="grow">' + esc(c.name) + ' <small>(' + c.spot + ')</small></span>' +
        '<button data-up="' + i + '">▲</button><button data-ren="' + i + '">Muuda</button><button class="danger" data-delc="' + i + '">✕</button></li>';
    });
    h += '</ul><div class="actions"><button class="left primary" data-a="addcar">+ Lisa sõiduk</button></div>';
    h += '<h3>Inimesed</h3><ul class="list">';
    db.people.forEach(function (p, i) {
      h += '<li><span class="grow">' + esc(p) + '</span><button data-pup="' + i + '">▲</button><button data-pren="' + i + '">Muuda</button><button class="danger" data-delp="' + i + '">✕</button></li>';
    });
    h += '</ul><div class="actions"><button class="left primary" data-a="addp">+ Lisa inimene</button></div>';

    h += '<h3>Öö/päeva vaade</h3><div class="form-row seg">' +
      seg('themeMode', [['time', 'Kellaaja järgi'], ['light', 'Ruumi valguse järgi'], ['day', 'Alati päev'], ['night', 'Alati öö']], s.themeMode) + '</div>' +
      '<div class="form-row"><label>Öö algab / lõpeb</label><input type="time" id="nf" value="' + s.nightFrom + '"> &nbsp; <input type="time" id="nt" value="' + s.nightTo + '"></div>' +
      '<div class="form-row"><label>Valguse lävi (öö kui tumedam)</label><input type="range" id="lt" min="0" max="255" value="' + s.lightThreshold + '"><span class="val" id="ltv">' + s.lightThreshold + '</span></div>' +
      '<div class="form-row"><label>Praegune ruumi valgus</label><span class="val" id="lnow">' + lightText() + '</span>' +
      '<button data-a="measure" style="height:48px;padding:0 16px;margin-left:10px">Mõõda → lävi</button></div>';

    h += '<h3>Liikumisandur (esikaamera)</h3><div class="form-row seg">' +
      seg('motion', [['1', 'Sees'], ['0', 'Väljas']], s.motion ? '1' : '0') + '</div>' +
      '<div class="form-row"><label>Tundlikkus</label><input type="range" id="sens" min="1" max="100" value="' + s.sensitivity + '"><span class="val" id="sensv">' + s.sensitivity + '</span></div>' +
      '<div class="form-row"><label>Ekraan mustaks pärast (min)</label><input type="number" id="slp" min="1" max="120" value="' + s.sleepMin + '"></div>' +
      '<div class="form-row"><label>Kaamera olek</label><span class="val" id="camst">' + cam.status + '</span>' +
      '<button data-a="camstart" style="height:48px;padding:0 16px;margin-left:10px">Käivita kaamera</button></div>';

    h += '<h3>Muu</h3>' +
      '<div class="form-row"><label>Hommiku/õhtu piir (kell)</label><input type="number" id="hs" min="6" max="18" value="' + s.halfSplit + '"></div>' +
      '<div class="form-row"><label>Seadete PIN (tühi = puudub)</label><input type="password" inputmode="numeric" id="pin" value="' + esc(s.pin) + '"></div>' +
      '<div class="form-row"><label>Varukoopia</label><button data-a="export" style="height:48px;padding:0 16px">Ekspordi</button>' +
      '<button data-a="import" style="height:48px;padding:0 16px;margin-left:8px">Impordi</button></div>' +
      '<p class="info">Versioon ' + VERSION + '. Andmed on ainult selles seadmes.</p>';
    h += '<div class="actions"><button class="primary" data-a="close">Valmis</button></div>';

    var d = openDialog(h);
    onClose = function () { applyTheme(); cam.apply(); };
    on(d, '[data-a=close]', 'click', closeDialog);
    on(d, '[data-a=addcar]', 'click', function () {
      var n = prompt('Sõiduki nimi:'); if (!n || !n.trim()) return;
      var sp = confirm('Kas auto seisab EES parklas? (OK = ees, Loobu = taga)') ? 'E' : 'T';
      db.cars.push({ id: uid(), name: n.trim(), spot: sp, washer: false, fuel: false, user: null, takenAt: 0 });
      save(); showSettings();
    });
    on(d, '[data-ren]', 'click', function () {
      var c = db.cars[+this.getAttribute('data-ren')], n = prompt('Uus nimi:', c.name);
      if (n && n.trim()) { c.name = n.trim(); save(); showSettings(); }
    });
    on(d, '[data-up]', 'click', function () { moveUp(db.cars, +this.getAttribute('data-up')); save(); showSettings(); });
    on(d, '[data-delc]', 'click', function () {
      var c = db.cars[+this.getAttribute('data-delc')];
      if (!confirm('Kustutan sõiduki "' + c.name + '" ja selle broneeringud?')) return;
      db.cars = db.cars.filter(function (x) { return x !== c; });
      db.bookings = db.bookings.filter(function (b) { return b.carId !== c.id; });
      save(); showSettings();
    });
    on(d, '[data-a=addp]', 'click', function () {
      var n = prompt('Inimese nimi:'); if (!n || !n.trim()) return;
      db.people.push(n.trim()); save(); showSettings();
    });
    on(d, '[data-pren]', 'click', function () {
      var i = +this.getAttribute('data-pren'), old = db.people[i], n = prompt('Uus nimi:', old);
      if (!n || !n.trim()) return;
      n = n.trim(); db.people[i] = n;
      db.bookings.forEach(function (b) { if (b.person === old) b.person = n; });
      db.cars.forEach(function (c) { if (c.user === old) c.user = n; });
      save(); showSettings();
    });
    on(d, '[data-pup]', 'click', function () { moveUp(db.people, +this.getAttribute('data-pup')); save(); showSettings(); });
    on(d, '[data-delp]', 'click', function () {
      var i = +this.getAttribute('data-delp');
      if (confirm('Kustutan "' + db.people[i] + '"?')) { db.people.splice(i, 1); save(); showSettings(); }
    });
    on(d, '[data-seg]', 'click', function () {
      var k = this.getAttribute('data-seg'), v = this.getAttribute('data-v');
      s[k] = k === 'motion' ? v === '1' : v; save();
      var sib = this.parentNode.querySelectorAll('[data-seg=' + k + ']');
      for (var i = 0; i < sib.length; i++) sib[i].className = sib[i] === this ? 'sel' : '';
      applyTheme(); cam.apply();
    });
    function bind(id, key, num) {
      var el = d.querySelector('#' + id);
      el.addEventListener('change', function () { s[key] = num ? +el.value : el.value; save(); applyTheme(); });
      el.addEventListener('input', function () { var v = d.querySelector('#' + id + 'v'); if (v) v.textContent = el.value; });
    }
    bind('nf', 'nightFrom'); bind('nt', 'nightTo'); bind('lt', 'lightThreshold', true);
    bind('sens', 'sensitivity', true); bind('slp', 'sleepMin', true); bind('hs', 'halfSplit', true); bind('pin', 'pin');
    on(d, '[data-a=measure]', 'click', function () {
      if (cam.light < 0) { alert('Kaamera ei tööta – valgust ei saa mõõta.'); return; }
      s.lightThreshold = Math.round(cam.light); save();
      d.querySelector('#lt').value = s.lightThreshold; d.querySelector('#ltv').textContent = s.lightThreshold;
    });
    on(d, '[data-a=camstart]', 'click', function () { cam.start(true); });
    on(d, '[data-a=export]', 'click', exportData);
    on(d, '[data-a=import]', 'click', importData);
    var liveTimer = setInterval(function () {
      if (!document.body.contains(d)) { clearInterval(liveTimer); return; }
      var l = d.querySelector('#lnow'), c = d.querySelector('#camst');
      if (l) l.textContent = lightText(); if (c) c.textContent = cam.status;
    }, 1000);
  }
  function seg(key, opts, cur) {
    return opts.map(function (o) { return '<button data-seg="' + key + '" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="sel"' : '') + '>' + o[1] + '</button>'; }).join('');
  }
  function moveUp(arr, i) { if (i > 0) { var t = arr[i - 1]; arr[i - 1] = arr[i]; arr[i] = t; } }
  function lightText() { return cam.light < 0 ? '–' : Math.round(cam.light) + (isNightByLight() ? ' (öö)' : ' (päev)'); }

  function exportData() {
    var txt = JSON.stringify(db);
    var d = openDialog('<h2>Varukoopia</h2><p class="info">Kopeeri see tekst ja salvesta kuhugi (nt e-kirja).</p>' +
      '<textarea id="ex" style="width:100%;height:240px;font-size:14px">' + esc(txt) + '</textarea>' +
      '<div class="actions"><button data-a="close">Sulge</button></div>');
    var ta = d.querySelector('#ex'); ta.focus(); ta.select();
    on(d, '[data-a=close]', 'click', function () { showSettings(); });
  }
  function importData() {
    var d = openDialog('<h2>Impordi varukoopia</h2><p class="info">Kleebi varukoopia tekst. NB! Praegused andmed asendatakse.</p>' +
      '<textarea id="im" style="width:100%;height:240px;font-size:14px"></textarea>' +
      '<div class="actions"><button data-a="close">Tühista</button><button class="danger" data-a="ok">Impordi</button></div>');
    on(d, '[data-a=close]', 'click', function () { showSettings(); });
    on(d, '[data-a=ok]', 'click', function () {
      try {
        var x = JSON.parse(d.querySelector('#im').value);
        if (!x.cars || !x.settings) throw new Error('vale formaat');
        localStorage.setItem(KEY, JSON.stringify(x)); db = load(); showSettings();
      } catch (e) { alert('Import ebaõnnestus: ' + e.message); }
    });
  }

  // ---------- Öö/päev ----------
  var lightNight = false; // hüstereesiga olek ruumi valguse järgi
  function toMin(s) { var p = (s || '0:0').split(':'); return (+p[0]) * 60 + (+p[1]); }
  function isNightByTime() {
    var d = new Date(), m = d.getHours() * 60 + d.getMinutes(), a = toMin(db.settings.nightFrom), b = toMin(db.settings.nightTo);
    return a > b ? (m >= a || m < b) : (m >= a && m < b);
  }
  function isNightByLight() {
    if (cam.light < 0) return isNightByTime();
    var t = db.settings.lightThreshold;
    if (lightNight && cam.light > t + 8) lightNight = false;
    else if (!lightNight && cam.light < t - 8) lightNight = true;
    return lightNight;
  }
  function applyTheme() {
    var m = db.settings.themeMode;
    var night = m === 'night' || (m === 'time' && isNightByTime()) || (m === 'light' && isNightByLight());
    document.body.className = night ? 'night' : 'day';
    document.getElementById('btnTheme').textContent = night ? '☀' : '🌙';
  }
  document.getElementById('btnTheme').addEventListener('click', function () {
    db.settings.themeMode = document.body.className === 'night' ? 'day' : 'night'; save(); applyTheme();
  });

  // ---------- Kaamera: liikumis- ja valgusandur ----------
  var cam = {
    status: 'väljas', light: -1, stream: null, timer: null, prev: null,
    video: document.getElementById('cam'), canvas: document.getElementById('camCanvas'),
    wanted: function () { return db.settings.motion || db.settings.themeMode === 'light'; },
    apply: function () { if (this.wanted()) this.start(false); else this.stop(); },
    start: function (userAsked) {
      var self = this;
      if (this.stream) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.status = 'pole toetatud (vana seade?)'; return; }
      this.status = 'käivitub…';
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 160 }, height: { ideal: 120 } }, audio: false })
        .then(function (st) {
          self.stream = st; self.video.srcObject = st;
          var p = self.video.play(); if (p && p.catch) p.catch(function () {});
          self.status = 'töötab'; self.prev = null;
          self.timer = setInterval(function () { self.sample(); }, 500);
        })
        .catch(function (e) {
          self.status = 'ei saa kasutada: ' + (e && e.name ? e.name : e);
          if (userAsked) alert('Kaamerat ei saanud käivitada (' + (e && e.name) + '). Luba kaamera seadme seadetes.');
        });
    },
    stop: function () {
      if (this.timer) clearInterval(this.timer); this.timer = null;
      if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); });
      this.stream = null; this.light = -1; this.status = 'väljas';
    },
    sample: function () {
      var v = this.video; if (!v.videoWidth) return;
      var ctx = this.canvas.getContext('2d'), w = this.canvas.width, h = this.canvas.height;
      try { ctx.drawImage(v, 0, 0, w, h); } catch (e) { return; }
      var px = ctx.getImageData(0, 0, w, h).data, n = w * h, cur = new Array(n), sum = 0, diff = 0;
      for (var i = 0; i < n; i++) {
        var y = (px[i * 4] * 3 + px[i * 4 + 1] * 6 + px[i * 4 + 2]) / 10;
        cur[i] = y; sum += y;
        if (this.prev) diff += Math.abs(y - this.prev[i]);
      }
      var mean = sum / n;
      this.light = this.light < 0 ? mean : this.light * 0.8 + mean * 0.2;
      if (this.prev) {
        // keskmine muutus pikslil, normaliseeritud heleduse järgi (automaatsäritus muudab kõike korraga)
        var md = diff / n;
        var thr = 2 + (100 - db.settings.sensitivity) * 0.25; // tundlikkus 100 → 2, 1 → ~27
        if (md > thr && db.settings.motion) activity();
      }
      this.prev = cur;
    }
  };

  // ---------- Uinumine ----------
  var sleepEl = document.getElementById('sleep');
  var lastActivity = Date.now();
  function activity() {
    lastActivity = Date.now();
    if (!sleepEl.classList.contains('hidden')) { sleepEl.classList.add('hidden'); render(); applyTheme(); requestWakeLock(); }
  }
  ['touchstart', 'mousedown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, activity, true);
  });
  // Puudutus mustal ekraanil ainult äratab, ei vajuta ruudule
  sleepEl.addEventListener('click', function (e) { e.stopPropagation(); });
  function checkSleep() {
    if (!db.settings.motion || !cam.stream) return; // ilma andurita ei uinu (muidu ei ärkaks ise)
    if (!overlay.classList.contains('hidden')) return;
    if (Date.now() - lastActivity > db.settings.sleepMin * 60000) sleepEl.classList.remove('hidden');
  }

  // ---------- Ekraan ärkvel ----------
  var wakeLock = null;
  function requestWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) {
      wakeLock = l; l.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { requestWakeLock(); cam.apply(); render(); applyTheme(); }
  });

  // ---------- Kell, nupud, tsükkel ----------
  function tick() {
    var d = new Date();
    document.getElementById('clock').textContent = dayLabel(d) + '  ' + hm(d.getTime());
  }
  document.getElementById('btnSettings').addEventListener('click', function () { withPin(showSettings); });
  document.getElementById('btnHistory').addEventListener('click', function () { showHistory(''); });

  setInterval(tick, 10000);
  setInterval(function () { if (overlay.classList.contains('hidden')) render(); applyTheme(); checkSleep(); }, 30000);
  setInterval(checkSleep, 5000);

  tick(); applyTheme(); render(); requestWakeLock(); cam.apply();

  // Esimene käivitus: kui inimesi pole, ava seaded
  if (!db.people.length && !localStorage.getItem(KEY + '.seen')) {
    localStorage.setItem(KEY + '.seen', '1'); save();
    setTimeout(showSettings, 300);
  }

  // ---------- Service worker (offline) ----------
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
    var reloading = false, hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      // esimene paigaldus ei vaja uuesti laadimist – ainult uus versioon
      if (reloading || !hadController) return; reloading = true;
      // uus versioon – laadi uuesti, kui dialoog pole lahti
      var go = function () { if (overlay.classList.contains('hidden')) location.reload(); else setTimeout(go, 5000); };
      go();
    });
  }

  // testimiseks
  window.__app = { db: function () { return db; }, render: render, version: VERSION };
})();
