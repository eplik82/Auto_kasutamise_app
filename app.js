/* Auto kasutamise app – offline PWA
 * Kirjutatud lihtsas ES2015-s (ilma raamistiketa), et töötaks vanadel iPadidel/Androididel.
 * Andmed: localStorage (ainult selles seadmes).
 */
(function () {
  'use strict';

  var VERSION = '0.5.0';
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
        motion: true, sensitivity: 50, sleepSec: 120,
        halfSplit: 12,         // hommik 00–12, õhtu 12–24
        cols: 'auto',          // ruudustik: auto | 3 | 4
        badge: true,           // punane ring broneeringute arvuga
        fullscreen: true       // täisekraan esimesel puudutusel (brauseris, nt Samsung Internet)
      }
    };
  }
  var db = load();

  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    var def = defaults();
    if (!d || !d.cars) return def;
    if (d.settings && d.settings.sleepMin && !d.settings.sleepSec) d.settings.sleepSec = d.settings.sleepMin * 60;
    d.settings = Object.assign(def.settings, d.settings || {});
    d.cars.forEach(function (c) { if (!c.tires) c.tires = 'S'; });
    d.people = d.people || []; d.bookings = d.bookings || []; d.history = d.history || [];
    d.services = d.services || [];
    migrateServices(d);
    return d;
  }
  // v0.3 → v0.4: poolpäevased hooldused (bookings type=service) → services {start, end, comment}
  function migrateServices(d) {
    var split = (d.settings && d.settings.halfSplit) || 12, old = [];
    d.bookings = d.bookings.filter(function (b) { if (b.type === 'service') { old.push(b); return false; } return true; });
    function st(b) { var x = parseYmd(b.date); if (b.half === 'O') x.setHours(split); return x.getTime(); }
    function en(b) { var x = parseYmd(b.date); if (b.half === 'H') x.setHours(split); else x.setDate(x.getDate() + 1); return x.getTime(); }
    old.sort(function (a, b) { return a.carId < b.carId ? -1 : a.carId > b.carId ? 1 : st(a) - st(b); });
    old.forEach(function (b) {
      var last = d.services[d.services.length - 1];
      if (last && last.carId === b.carId && last.end === st(b)) last.end = en(b);
      else d.services.push({ id: b.id, carId: b.carId, start: st(b), end: en(b), comment: '' });
    });
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
  function isService(b) { return b.type === 'service'; } // (vana formaat, enam ei kasutata)
  // Lähim broneering, mis algab ≤ 24 h pärast või juba kestab
  function soonBooking(carId) {
    var now = Date.now(), list = carBookings(carId);
    for (var i = 0; i < list.length; i++) {
      if (slotStart(list[i]) - now <= DAY_MS && slotEnd(list[i]) > now) return list[i];
    }
    return null;
  }

  // ---------- Hooldused: { id, carId, start, end, comment } ----------
  function purgeServices() {
    var now = Date.now(), n = db.services.length;
    db.services = db.services.filter(function (v) { return v.end > now && carById(v.carId); });
    if (db.services.length !== n) save();
  }
  function carServices(carId) {
    return db.services.filter(function (v) { return v.carId === carId; }).sort(function (a, b) { return a.start - b.start; });
  }
  function serviceNow(carId) {
    var now = Date.now(), l = carServices(carId);
    for (var i = 0; i < l.length; i++) if (l[i].start <= now && l[i].end > now) return l[i];
    return null;
  }
  function soonService(carId) {  // algab ≤ 24 h pärast
    var now = Date.now(), l = carServices(carId);
    for (var i = 0; i < l.length; i++) if (l[i].start > now && l[i].start - now <= DAY_MS) return l[i];
    return null;
  }
  function serviceOverlap(carId, t0, t1, exceptId) {
    var l = carServices(carId);
    for (var i = 0; i < l.length; i++) if (l[i].id !== exceptId && l[i].start < t1 && l[i].end > t0) return l[i];
    return null;
  }
  // isEnd: lõpuaeg kesköösel näidatakse eelmise päeva "24:00" (mitte järgmise päeva 00:00)
  function relTime(t, isEnd) {
    var d = new Date(t), mid = isEnd && d.getHours() === 0 && d.getMinutes() === 0;
    if (mid) d = new Date(t - 60000);
    var ds = ymd(d), today = ymd(new Date()), tom = ymd(new Date(Date.now() + DAY_MS));
    return (ds === today ? 'täna' : ds === tom ? 'homme' : dayLabel(d)) + ' ' + (mid ? '24:00' : hm(t));
  }
  function serviceRange(v) {
    var sameDay = ymd(new Date(v.start)) === ymd(new Date(v.end - 60000));
    return relTime(v.start) + ' – ' + (sameDay ? (relTime(v.end, true).split(' ').pop()) : relTime(v.end, true));
  }
  function serviceLabel(v) { return 'kuni ' + relTime(v.end, true); }
  function findBooking(carId, date, half) {
    for (var i = 0; i < db.bookings.length; i++) {
      var b = db.bookings[i];
      if (b.carId === carId && b.date === date && b.half === half) return b;
    }
    return null;
  }

  // ---------- Armatuurlaua ikoonid (SVG) ----------
  var ICONS = {
    // klaasipesuvedelik: tuuleklaas + keskel punktiirjoon + kaks kaarduvat juga
    washer: '<svg viewBox="15 10 270 220" fill="none" stroke="currentColor" stroke-width="15" stroke-linejoin="round">' +
      '<path d="M30 130 Q150 55 270 130 L192 212 Q150 188 108 212 Z"/>' +
      '<path d="M150 200 V55" stroke-dasharray="24 14"/>' +
      '<path d="M150 58 C150 22 82 20 82 72" stroke-dasharray="20 12"/>' +
      '<path d="M150 58 C150 22 218 20 218 72" stroke-dasharray="20 12"/></svg>',
    // kütus: tanur
    fuel: '<svg viewBox="0 0 24 24" fill="currentColor">' +
      '<path fill-rule="evenodd" d="M4 4.5 A1.5 1.5 0 0 1 5.5 3 H12.5 A1.5 1.5 0 0 1 14 4.5 V20 H4 Z M6 5.5 V10 H12 V5.5 Z"/>' +
      '<rect x="2.5" y="20" width="13" height="2" rx=".5"/>' +
      '<path d="M14 9 H15.5 A1.5 1.5 0 0 1 17 10.5 V16.5 A1.5 1.5 0 0 0 20 16.5 V8.5 L17.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  // lumehelves (talverehvid)
  var SNOW_ARM = '<path d="M12 12 V2.5 M9.3 4.6 L12 7 L14.7 4.6"/>';
  ICONS.snow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    [0, 60, 120, 180, 240, 300].map(function (a) { return '<g transform="rotate(' + a + ' 12 12)">' + SNOW_ARM + '</g>'; }).join('') + '</svg>';
  var ICON_TITLE = { washer: 'Klaasipesuvedelik otsas', fuel: 'Kütust vähe' };
  function lamp(name) { return '<span class="lamp" title="' + ICON_TITLE[name] + '">' + ICONS[name] + '</span>'; }
  function lamps(o) { return (o.washer ? lamp('washer') : '') + (o.fuel ? lamp('fuel') : ''); }

  // ---------- Pealeht ----------
  var grid = document.getElementById('grid');
  function render() {
    purgeBookings(); purgeServices();
    var html = '';
    var n = db.cars.length, cls = '';
    if (!n) html = '<div class="empty">Sõidukeid pole. Lisa need seadetes ⚙.</div>';
    db.cars.forEach(function (c) {
      var sb = soonBooking(c.id), sv = serviceNow(c.id), ss = soonService(c.id);
      // kollane: lähim broneering või eelseisev hooldus (kumb varem)
      var firstSoon = (ss && (!sb || ss.start < slotStart(sb))) ? 'svc' : (sb ? 'bk' : null);
      var state = c.user ? 'red' : (sv ? 'grey' : (firstSoon ? 'yellow' : 'green'));
      var flags = lamps(c);
      html += '<div class="tile ' + state + ' ' + cls + '" data-id="' + c.id + '">';
      if (state !== 'red') html += '<div class="spot">' + c.spot + '</div>';
      if (c.tires === 'W') html += '<div class="tire" title="Talverehvid">' + ICONS.snow + '</div>';
      html += '<div class="name">' + esc(c.name) + '</div>';
      if (state === 'red') {
        html += '<div class="who">' + esc(c.user) + '</div><div class="sub">alates ' + (sameDay(c.takenAt) ? hm(c.takenAt) : fullTime(c.takenAt)) + '</div>';
        if (sv) html += '<div class="note">🔧 hooldus ' + serviceLabel(sv) + '</div>';
        else if (firstSoon === 'svc') html += '<div class="note">🔧 hooldus ' + relTime(ss.start) + '</div>';
        else if (sb) html += '<div class="note">📅 ' + esc(sb.person) + ' ' + bookingLabel(sb) + '</div>';
      } else if (state === 'grey') {
        html += '<div class="who">🔧 Hooldus</div><div class="sub">' + serviceLabel(sv) + '</div>';
        if (sv.comment) html += '<div class="sub cmt">' + esc(sv.comment) + '</div>';
      } else if (state === 'yellow' && firstSoon === 'svc') {
        html += '<div class="who">🔧 Hooldus</div><div class="sub">' + serviceRange(ss) + '</div>';
        if (ss.comment) html += '<div class="sub cmt">' + esc(ss.comment) + '</div>';
      } else if (state === 'yellow') {
        html += '<div class="who">📅 ' + esc(sb.person) + '</div><div class="sub">' + bookingLabel(sb) + '</div>';
      }
      if (flags) html += '<div class="flags">' + flags + '</div>';
      html += '</div>';
    });
    grid.innerHTML = html;
    fitTiles();
    updBadge();
  }
  // Kõik ruudud mahuvad ekraanile ilma kerimiseta: vali veergude arv, mis annab suurimad ruudud
  function fitTiles() {
    var tiles = grid.querySelectorAll('.tile'), n = tiles.length;
    if (!n) return;
    var W = grid.clientWidth - 16, H = grid.clientHeight - 16, M = 16; // grid padding 8 + tile margin 8
    var best = null;
    var fixed = +db.settings.cols || 0;
    for (var cols = fixed || 1; cols <= (fixed || n); cols++) {
      var rows = Math.ceil(n / cols), w = W / cols - M, h = H / rows - M;
      if (w <= 0 || h <= 0) continue;
      var score = Math.min(w / 1.5, h); // eelistab ~3:2 ruute
      if (!best || score > best.score) best = { score: score, w: w, h: h };
    }
    if (!best) return;
    var fs = Math.max(16, Math.min(best.h * 0.17, best.w * 0.11, 48));
    for (var i = 0; i < n; i++) {
      var st = tiles[i].style;
      st.width = Math.floor(best.w) + 'px'; st.height = Math.floor(best.h) + 'px';
      st.minHeight = '0'; st.fontSize = Math.round(fs) + 'px';
    }
  }
  window.addEventListener('resize', fitTiles);
  window.addEventListener('orientationchange', function () { setTimeout(fitTiles, 300); });
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
    // Vormiga aken: ülaserva ankurdatud (klaviatuur ei liiguta seda) ja taustale puudutus ei sulge
    // (muidu klaviatuuri sulgumisel hüppab aken ja "Salvesta" puudutus tabab tausta → andmed kaovad).
    overlay.className = overlay.firstChild.querySelector('input, select, textarea') ? 'form' : '';
    return overlay.firstChild;
  }
  function closeDialog() {
    overlay.classList.add('hidden'); overlay.innerHTML = '';
    var f = onClose; onClose = null; if (f) f();
    render();
  }
  overlay.addEventListener('click', function (e) {
    if (e.target !== overlay) return;
    if (/\bform\b/.test(overlay.className)) { var a = document.activeElement; if (a && a.blur) a.blur(); return; }
    closeDialog();
  });
  function on(root, sel, ev, fn) {
    var els = root.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) els[i].addEventListener(ev, fn);
  }
  function confirmBox(text, okText, fn, okClass, onNo) {
    var d = openDialog('<h2>' + text + '</h2><div class="actions"><button data-a="no">Ei</button>' +
      '<button data-a="yes" class="' + (okClass || 'primary') + '">' + okText + '</button></div>', true);
    on(d, '[data-a=no]', 'click', onNo || closeDialog);
    on(d, '[data-a=yes]', 'click', function () { fn(); });
  }

  // Võtmine: nimede loetelu + Broneeri nupp + selle auto broneeringud
  function showTake(car) {
    var sb = soonBooking(car.id), sv = serviceNow(car.id), ss = soonService(car.id);
    var h = '<h2>' + esc(car.name) + ' – kes võtab?</h2>';
    if (sv) h += '<p class="info">🔧 Hoolduses <b>' + serviceLabel(sv) + '</b>' + (sv.comment ? ' – ' + esc(sv.comment) : '') +
      ' <button class="danger" data-a="endsvc" style="height:44px;padding:0 14px;margin-left:10px">Lõpeta hooldus</button></p>';
    else if (ss) h += '<p class="info">🔧 Hooldus <b>' + serviceRange(ss) + '</b>' + (ss.comment ? ' – ' + esc(ss.comment) : '') + '</p>';
    if (sv) {}
    else if (sb) h += '<p class="info">📅 Broneeritud: <b>' + esc(sb.person) + '</b>, ' + bookingLabel(sb) + '</p>';
    else h += '<p class="info">Auto on parklas: <b>' + (car.spot === 'E' ? 'ees' : 'taga') + '</b></p>';
    if (!db.people.length) h += '<p class="info">Inimesi pole. Lisa need seadetes ⚙.</p>';
    h += '<div class="btngrid' + (db.people.length > 12 ? ' dense' : '') + '">';
    db.people.forEach(function (p, i) {
      h += '<button data-p="' + i + '"' + (sb && sb.person === p ? ' class="booker"' : '') + '>' + esc(p) + '</button>';
    });
    h += '</div>';
    var list = carBookings(car.id), svl = carServices(car.id);
    if (svl.length) {
      h += '<h3>Hooldused</h3><ul class="list">';
      svl.forEach(function (v) {
        h += '<li><span class="grow">🔧 ' + serviceRange(v) + (v.comment ? ' – <i>' + esc(v.comment) + '</i>' : '') + '</span>' +
          '<button data-editsvc="' + v.id + '">Muuda</button><button data-delsvc="' + v.id + '" class="danger">Tühista</button></li>';
      });
      h += '</ul>';
    }
    if (list.length) {
      h += '<h3>Broneeringud</h3><ul class="list">';
      list.forEach(function (b) {
        h += '<li><span class="grow">' + esc(b.person) + ' – ' + bookingLabel(b) + '</span><button data-del="' + b.id + '" class="danger">Tühista</button></li>';
      });
      h += '</ul>';
    }
    h += '<div class="actions"><button class="left warn" data-a="book">📅 Broneeri</button>' +
      '<button class="left svc" data-a="svc">🔧 Hooldus</button><button data-a="close">Sulge</button></div>';
    var d = openDialog(h);
    on(d, '[data-a=close]', 'click', closeDialog);
    on(d, '[data-a=book]', 'click', function () { showBookPerson(car); });
    on(d, '[data-a=svc]', 'click', function () { showServiceForm(car, null); });
    on(d, '[data-editsvc]', 'click', function () { showServiceForm(car, svcById(this.getAttribute('data-editsvc'))); });
    on(d, '[data-delsvc]', 'click', function () {
      var v = svcById(this.getAttribute('data-delsvc'));
      confirmBox('Tühistan hoolduse ' + serviceRange(v) + '?', 'Tühista', function () {
        db.services = db.services.filter(function (x) { return x !== v; }); save(); showTake(car);
      }, 'danger', function () { showTake(car); });
    });
    on(d, '[data-a=endsvc]', 'click', function () {
      confirmBox('Lõpetan hoolduse – auto on jälle kasutatav?', 'Lõpeta', function () {
        db.services = db.services.filter(function (x) { return x !== sv; });
        save(); closeDialog();
      }, 'danger', function () { showTake(car); });
    });
    on(d, '[data-p]', 'click', function () {
      var person = db.people[+this.getAttribute('data-p')];
      if (sv || ss) {
        confirmBox((sv ? 'Auto on hoolduses ' + serviceLabel(sv) : 'Hooldus algab ' + relTime(ss.start)) +
          '. Kas ' + esc(person) + ' võtab ikkagi?', 'Võtan', function () { take(car, person); }, 'warn', function () { showTake(car); });
      } else if (sb && sb.person !== person) {
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
      return !(b.carId === car.id && !isService(b) && b.person === person && slotStart(b) <= now);
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
    var h = '<h2>' + esc(car.name) + ' – kes broneerib?</h2><div class="btngrid' + (db.people.length > 12 ? ' dense' : '') + '">';
    db.people.forEach(function (p, i) { h += '<button data-p="' + i + '">' + esc(p) + '</button>'; });
    h += '</div><div class="actions"><button data-a="back">Tagasi</button></div>';
    var d = openDialog(h);
    on(d, '[data-a=back]', 'click', function () { showTake(car); });
    on(d, '[data-p]', 'click', function () { showBookSlots(car, db.people[+this.getAttribute('data-p')]); });
  }
  function showBookSlots(car, person) {
    var picked = {}; // 'YYYY-MM-DD|H' -> true
    var now = Date.now();
    var h = '<h2>' + esc(car.name) + ' – ' + esc(person) + '</h2><p class="info">Vali ' +
      'poolpäevad (hommik 00–' + pad(db.settings.halfSplit) + ', õhtu ' + pad(db.settings.halfSplit) +
      '–24). Kollane = broneeritud, hall = hooldus.</p><table class="days">';
    for (var i = 0; i < BOOK_DAYS; i++) {
      var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
      var ds = ymd(d);
      h += '<tr><td class="d">' + (i === 0 ? 'Täna ' : (i === 1 ? 'Homme ' : '')) + dayLabel(d) + '</td>';
      ['H', 'O'].forEach(function (half) {
        var ex = findBooking(car.id, ds, half), past = slotEnd({ date: ds, half: half }) <= now;
        var sl = { date: ds, half: half }, so = serviceOverlap(car.id, slotStart(sl), slotEnd(sl));
        h += '<td><button data-k="' + ds + '|' + half + '"' + (ex ? ' class="taken" disabled' : (so ? ' class="svc" disabled' : '')) + (past ? ' disabled' : '') + '>' +
          (ex ? esc(ex.person) : (so ? '🔧 Hooldus' : (half === 'H' ? 'Hommik' : 'Õhtu'))) + '</button></td>';
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
        if (findBooking(car.id, p[0], p[1])) return;
        db.bookings.push({ id: uid(), carId: car.id, person: person, date: p[0], half: p[1] });
      });
      save(); showTake(car);
    });
  }

  // ---------- Hoolduse sisestamine: kuupäev + kellaaeg + kommentaar ----------
  function svcById(id) { for (var i = 0; i < db.services.length; i++) if (db.services[i].id === id) return db.services[i]; return null; }
  function toLocalInput(t) { var d = new Date(t); return { date: ymd(d), time: hm(t) }; }
  function fromInputs(date, time) {
    if (!date || !time) return NaN;
    var p = date.split('-'), q = time.split(':');
    return new Date(+p[0], +p[1] - 1, +p[2], +q[0], +q[1]).getTime();
  }
  // Oma kuupäeva/kella valik: alati pp.kk.aaaa ja 24 h (brauseri date/time väljad sõltuvad seadme keelest)
  function opts(from, to, cur, step) {
    var h = '';
    for (var i = from; i <= to; i += (step || 1)) h += '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + pad(i) + '</option>';
    return h;
  }
  function dtPicker(id, t) {
    var d = new Date(t), y = d.getFullYear(), m = Math.round(d.getMinutes() / 5) * 5;
    if (m === 60) m = 55;
    return '<span class="dtp" id="' + id + '">' +
      '<select data-p="d">' + opts(1, 31, d.getDate()) + '</select>.' +
      '<select data-p="m">' + opts(1, 12, d.getMonth() + 1) + '</select>.' +
      '<select data-p="y">' + opts(y - 1, y + 2, y) + '</select>' +
      '<span class="gap"></span>' +
      '<select data-p="h">' + opts(0, 23, d.getHours()) + '</select>:' +
      '<select data-p="i">' + opts(0, 55, m, 5) + '</select></span>';
  }
  function readPicker(root, id) {
    var el = root.querySelector('#' + id), g = function (k) { return +el.querySelector('[data-p=' + k + ']').value; };
    var dt = new Date(g('y'), g('m') - 1, g('d'), g('h'), g('i'));
    if (dt.getDate() !== g('d')) return NaN; // nt 31.02
    return dt.getTime();
  }
  function setPicker(root, id, t) {
    var el = root.querySelector('#' + id), d = new Date(t);
    var set = function (k, v) { el.querySelector('[data-p=' + k + ']').value = v; };
    set('d', d.getDate()); set('m', d.getMonth() + 1); set('y', d.getFullYear()); set('h', d.getHours()); set('i', Math.min(55, Math.round(d.getMinutes() / 5) * 5));
  }
  function timePicker(id, hhmm) {
    var p = (hhmm || '00:00').split(':');
    return '<span class="dtp" id="' + id + '"><select data-p="h">' + opts(0, 23, +p[0]) + '</select>:' +
      '<select data-p="i">' + opts(0, 55, Math.round(+p[1] / 5) * 5, 5) + '</select></span>';
  }
  function readTime(root, id) {
    var el = root.querySelector('#' + id);
    return pad(+el.querySelector('[data-p=h]').value) + ':' + pad(+el.querySelector('[data-p=i]').value);
  }
  function showServiceForm(car, v) {
    var tom = new Date(); tom.setDate(tom.getDate() + 1); tom.setHours(8, 0, 0, 0);
    var st = v ? v.start : tom.getTime(), en = v ? v.end : tom.getTime() + 9 * 3600000;
    var h = '<h2>' + esc(car.name) + ' – 🔧 ' + (v ? 'muuda hooldust' : 'uus hooldus') + '</h2>' +
      '<div class="form-row"><label>Algus</label>' + dtPicker('ps', st) + '</div>' +
      '<div class="form-row"><label>Lõpp</label>' + dtPicker('pe', en) + '</div>' +
      '<div class="form-row"><label>Kommentaar</label><input type="text" id="cm" maxlength="80" placeholder="nt rehvivahetus, Autokeskus" value="' + esc(v ? v.comment : '') + '" style="flex:1"></div>' +
      '<p class="info">24 h enne algust läheb ruut kollaseks (🔧 hoiatus), hoolduse ajal on ruut hall.</p>' +
      '<div class="actions"><button data-a="back">Tagasi</button><button class="primary" data-a="ok">Salvesta hooldus</button></div>';
    var d = openDialog(h);
    d.querySelector('#cm').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); this.blur(); d.querySelector('[data-a=ok]').click(); } });
    // kui algus nihkub lõpust hilisemaks, nihuta lõpp samale päevale (sama kestusega kui võimalik)
    on(d, '#ps select', 'change', function () {
      var a = readPicker(d, 'ps'), b = readPicker(d, 'pe');
      if (!isNaN(a) && (isNaN(b) || b <= a)) setPicker(d, 'pe', a + 9 * 3600000);
    });
    on(d, '[data-a=back]', 'click', function () { showTake(car); });
    on(d, '[data-a=ok]', 'click', function () {
      var a = readPicker(d, 'ps'), b = readPicker(d, 'pe');
      var cm = d.querySelector('#cm').value.trim();
      if (isNaN(a) || isNaN(b)) { alert('Vigane kuupäev (nt 31.02). Kontrolli algust ja lõppu.'); return; }
      if (b <= a) { alert('Lõpp peab olema hiljem kui algus.'); return; }
      if (b <= Date.now()) { alert('See aeg on juba möödas.'); return; }
      var o = serviceOverlap(car.id, a, b, v ? v.id : null);
      if (o) { alert('Sel ajal on juba hooldus: ' + serviceRange(o)); return; }
      function doSave() {
        if (v) { v.start = a; v.end = b; v.comment = cm; }
        else db.services.push({ id: uid(), carId: car.id, start: a, end: b, comment: cm });
        save(); showTake(car);
      }
      var clash = carBookings(car.id).filter(function (x) { return slotStart(x) < b && slotEnd(x) > a; });
      if (clash.length) {
        confirmBox('Sel ajal on broneering: ' + clash.map(function (x) { return esc(x.person) + ' ' + bookingLabel(x); }).join(', ') +
          '. Salvestan hoolduse ikkagi?', 'Salvesta', doSave, 'warn', function () { showServiceForm(car, v); });
      } else doSave();
    });
  }

  // ---------- Broneeringute kalender ----------
  var CAL_DAYS = 14;
  function futureBookings() {
    var now = Date.now();
    return db.bookings.filter(function (b) { return slotEnd(b) > now && carById(b.carId); })
      .sort(function (a, b) { return slotStart(a) - slotStart(b); });
  }
  function updBadge() {
    var el = document.getElementById('bookBadge'), n = futureBookings().length;
    el.textContent = n > 99 ? '99+' : n;
    el.style.display = (db.settings.badge && n > 0) ? '' : 'none';
  }
  function showCalendar(off) {
    off = off || 0; purgeBookings();
    var now = Date.now(), start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() + off);
    var days = [];
    for (var i = 0; i < CAL_DAYS; i++) { var dd = new Date(start); dd.setDate(start.getDate() + i); days.push(dd); }
    var today = ymd(new Date());
    var h = '<h2>Broneeringud</h2><div class="calnav"><button data-nav="-7">◀ Nädal tagasi</button>' +
      '<button data-nav="0"' + (off === 0 ? ' class="sel"' : '') + '>Täna</button><button data-nav="7">Nädal edasi ▶</button></div>';
    h += '<div class="calwrap"><table class="cal"><tr><th class="car"></th>';
    days.forEach(function (d) {
      h += '<th colspan="2" class="' + (ymd(d) === today ? 'today' : '') + (d.getDay() === 0 || d.getDay() === 6 ? ' we' : '') + '">' + dayLabel(d) + '</th>';
    });
    h += '</tr><tr><th class="car"></th>';
    days.forEach(function (d) { var t = ymd(d) === today ? ' today' : ''; h += '<th class="hh' + t + '">H</th><th class="hh' + t + '">Õ</th>'; });
    h += '</tr>';
    db.cars.forEach(function (c, ci) {
      h += '<tr><th class="car">' + esc(c.name) + '</th>';
      days.forEach(function (d) {
        var ds = ymd(d);
        ['H', 'O'].forEach(function (half) {
          var sl = { date: ds, half: half }, b = findBooking(c.id, ds, half), past = slotEnd(sl) <= now;
          var so = serviceOverlap(c.id, slotStart(sl), slotEnd(sl));
          var cls = b ? 'bk' : (so ? 'svc' : (past ? 'past' : 'free'));
          if (ds === today) cls += ' today';
          h += '<td class="' + cls + '" data-c="' + ci + '" data-k="' + ds + '|' + half + '"' + (so ? ' data-svc="' + so.id + '" title="' + esc(so.comment) + '"' : '') + '>' +
            (b ? esc(b.person) : (so ? '🔧' : '')) + '</td>';
        });
      });
      h += '</tr>';
    });
    h += '</table></div><p class="info">Puuduta vaba lahtrit, et broneerida; broneeringut, et tühistada. Kollane = broneering, hall 🔧 = hooldus.</p>';
    var list = futureBookings();
    h += '<h3>Lähimad broneeringud (' + list.length + ')</h3><ul class="list">';
    list.slice(0, 40).forEach(function (b) {
      h += '<li><span class="grow"><b>' + bookingLabel(b) + '</b> – ' + esc(carById(b.carId).name) + ' – ' + esc(b.person) +
        '</span><button class="danger" data-del="' + b.id + '">Tühista</button></li>';
    });
    if (!list.length) h += '<li>Broneeringuid pole.</li>';
    h += '</ul><div class="actions"><button class="primary" data-a="close">Sulge</button></div>';
    var dlg = openDialog(h);
    dlg.className += ' wide';
    on(dlg, '[data-a=close]', 'click', closeDialog);
    on(dlg, '[data-nav]', 'click', function () { var v = +this.getAttribute('data-nav'); showCalendar(v === 0 ? 0 : Math.max(0, off + v)); });
    function cancel(b) {
      var what = 'broneeringu (' + esc(b.person) + ')';
      confirmBox('Tühistan ' + what + ': ' + esc(carById(b.carId).name) + ', ' + bookingLabel(b) + '?', 'Tühista', function () {
        db.bookings = db.bookings.filter(function (x) { return x.id !== b.id; }); save(); showCalendar(off);
      }, 'danger', function () { showCalendar(off); });
    }
    on(dlg, '[data-del]', 'click', function () {
      var id = this.getAttribute('data-del');
      for (var i = 0; i < db.bookings.length; i++) if (db.bookings[i].id === id) return cancel(db.bookings[i]);
    });
    on(dlg, 'td[data-k]', 'click', function () {
      var car = db.cars[+this.getAttribute('data-c')], k = this.getAttribute('data-k').split('|');
      var b = findBooking(car.id, k[0], k[1]);
      if (b) return cancel(b);
      var svid = this.getAttribute('data-svc');
      if (svid) {
        var v = svcById(svid);
        return confirmBox('🔧 Hooldus ' + esc(car.name) + ': ' + serviceRange(v) + (v.comment ? ' – ' + esc(v.comment) : '') + '. Tühistan hoolduse?',
          'Tühista', function () { db.services = db.services.filter(function (x) { return x !== v; }); save(); showCalendar(off); },
          'danger', function () { showCalendar(off); });
      }
      if (/past/.test(this.className)) return;
      // vaba lahter → vali nimi
      var hh = '<h2>' + esc(car.name) + ' – ' + bookingLabel({ date: k[0], half: k[1] }) + '</h2><p class="info">Kes broneerib?</p>' +
        '<div class="btngrid' + (db.people.length > 12 ? ' dense' : '') + '">';
      db.people.forEach(function (p, i) { hh += '<button data-p="' + i + '">' + esc(p) + '</button>'; });
      hh += '</div><div class="actions"><button data-a="back">Tagasi</button></div>';
      var d2 = openDialog(hh);
      on(d2, '[data-a=back]', 'click', function () { showCalendar(off); });
      on(d2, '[data-p]', 'click', function () {
        db.bookings.push({ id: uid(), carId: car.id, person: db.people[+this.getAttribute('data-p')], date: k[0], half: k[1] });
        save(); showCalendar(off);
      });
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

  var settingsTab = 'cars';
  var SLEEP_OPTS = [[15, '15 s'], [30, '30 s'], [45, '45 s'], [60, '1 min'], [120, '2 min'], [300, '5 min'], [600, '10 min'], [900, '15 min'], [1800, '30 min'], [3600, '1 h']];
  function showSettings(tab) {
    if (tab) settingsTab = tab;
    var s = db.settings, t = settingsTab;
    var h = '<div class="tabs"><button data-tab="cars"' + (t === 'cars' ? ' class="sel"' : '') + '>🚗 Sõidukid</button>' +
      '<button data-tab="people"' + (t === 'people' ? ' class="sel"' : '') + '>👤 Inimesed</button>' +
      '<button data-tab="opts"' + (t === 'opts' ? ' class="sel"' : '') + '>⚙ Seaded</button></div>';
    if (t === 'cars') {
    h += '<p><button class="primary bigadd" data-a="addcar">+ Lisa sõiduk</button></p><ul class="list">';
    db.cars.forEach(function (c, i) {
      h += '<li><span class="grow">' + esc(c.name) + ' <small>(' + c.spot + ')</small></span>' +
        '<span class="seg tires"><button data-tire="' + i + '" data-v="S"' + (c.tires !== 'W' ? ' class="sel"' : '') + '>☀ Suverehvid</button>' +
        '<button data-tire="' + i + '" data-v="W"' + (c.tires === 'W' ? ' class="sel"' : '') + '>❄ Talverehvid</button></span>' +
        '<button data-up="' + i + '">▲</button><button data-ren="' + i + '">Muuda</button><button class="danger" data-delc="' + i + '">✕</button></li>';
    });
    h += '</ul>';
    } else if (t === 'people') {
    h += '<p><button class="primary bigadd" data-a="addp">+ Lisa inimene</button></p><ul class="list">';
    db.people.forEach(function (p, i) {
      h += '<li><span class="grow">' + esc(p) + '</span><button data-pup="' + i + '">▲</button><button data-pren="' + i + '">Muuda</button><button class="danger" data-delp="' + i + '">✕</button></li>';
    });
    h += '</ul>';
    } else {
    h += '<h3>Ruudustik</h3><div class="form-row seg">' +
      seg('cols', [['auto', 'Automaatne'], ['3', '3 tulpa'], ['4', '4 tulpa']], String(s.cols)) + '</div>';
    h += '<h3>Täisekraan</h3><div class="form-row seg">' +
      seg('fullscreen', [['1', 'Puudutusel täisekraan'], ['0', 'Väljas']], s.fullscreen ? '1' : '0') + '</div>';
    h += '<h3>Broneeringute arv nupul (punane ring)</h3><div class="form-row seg">' +
      seg('badge', [['1', 'Näita'], ['0', 'Peida']], s.badge ? '1' : '0') + '</div>';
    h += '<h3>Öö/päeva vaade</h3><div class="form-row seg">' +
      seg('themeMode', [['time', 'Kellaaja järgi'], ['light', 'Ruumi valguse järgi'], ['day', 'Alati päev'], ['night', 'Alati öö']], s.themeMode) + '</div>' +
      '<div class="form-row"><label>Öö algab / lõpeb</label>' + timePicker('nf', s.nightFrom) + '<span class="gap">–</span>' + timePicker('nt', s.nightTo) + '</div>' +
      '<div class="form-row"><label>Valguse lävi (öö kui tumedam)</label><input type="range" id="lt" min="0" max="255" value="' + s.lightThreshold + '"><span class="val" id="ltv">' + s.lightThreshold + '</span></div>' +
      '<div class="form-row"><label>Praegune ruumi valgus</label><span class="val" id="lnow">' + lightText() + '</span>' +
      '<button data-a="measure" style="height:48px;padding:0 16px;margin-left:10px">Mõõda → lävi</button></div>';

    h += '<h3>Liikumisandur (esikaamera)</h3><div class="form-row seg">' +
      seg('motion', [['1', 'Sees'], ['0', 'Väljas']], s.motion ? '1' : '0') + '</div>' +
      '<div class="form-row"><label>Tundlikkus</label><input type="range" id="sens" min="1" max="100" value="' + s.sensitivity + '"><span class="val" id="sensv">' + s.sensitivity + '</span></div>' +
      '<div class="form-row"><label>Ekraan mustaks pärast</label><select id="slp">' +
      SLEEP_OPTS.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === +s.sleepSec ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-row"><label>Kaamera olek</label><span class="val" id="camst">' + cam.status + '</span>' +
      '<button data-a="camstart" style="height:48px;padding:0 16px;margin-left:10px">Testi kaamerat</button></div>' +
      '<p class="info">Kaamera töötab ainult siis, kui ekraan on must (ootab liikumist). Testimiseks töötab ta, kuni see aken on lahti.</p>' +
      '<div class="form-row"><label>Liikumine</label><span class="ind" id="motInd"><i></i><span>–</span></span></div>';

    h += '<h3>Muu</h3>' +
      '<div class="form-row"><label>Hommiku/õhtu piir (kell)</label><input type="number" id="hs" min="6" max="18" value="' + s.halfSplit + '"></div>' +
      '<div class="form-row"><label>Seadete PIN (tühi = puudub)</label><input type="password" inputmode="numeric" id="pin" value="' + esc(s.pin) + '"></div>' +
      '<div class="form-row"><label>Varukoopia</label><button data-a="export" style="height:48px;padding:0 16px">Ekspordi</button>' +
      '<button data-a="import" style="height:48px;padding:0 16px;margin-left:8px">Impordi</button></div>' +
      '<p class="info">Versioon ' + VERSION + '. Andmed on ainult selles seadmes.</p>';
    }
    h += '<div class="actions"><button class="primary" data-a="close">Valmis</button></div>';

    var d = openDialog(h);
    on(d, '[data-tab]', 'click', function () { showSettings(this.getAttribute('data-tab')); });
    onClose = function () { cam.testing = false; applyTheme(); cam.apply(); };
    on(d, '[data-a=close]', 'click', closeDialog);
    on(d, '[data-a=addcar]', 'click', function () {
      var n = prompt('Sõiduki nimi:'); if (!n || !n.trim()) return;
      var sp = confirm('Kas auto seisab EES parklas? (OK = ees, Loobu = taga)') ? 'E' : 'T';
      db.cars.push({ id: uid(), name: n.trim(), spot: sp, tires: 'S', washer: false, fuel: false, user: null, takenAt: 0 });
      save(); showSettings();
    });
    on(d, '[data-ren]', 'click', function () {
      var c = db.cars[+this.getAttribute('data-ren')], n = prompt('Uus nimi:', c.name);
      if (n && n.trim()) { c.name = n.trim(); save(); showSettings(); }
    });
    on(d, '[data-tire]', 'click', function () {
      db.cars[+this.getAttribute('data-tire')].tires = this.getAttribute('data-v'); save(); showSettings();
    });
    on(d, '[data-up]', 'click', function () { moveUp(db.cars, +this.getAttribute('data-up')); save(); showSettings(); });
    on(d, '[data-delc]', 'click', function () {
      var c = db.cars[+this.getAttribute('data-delc')];
      if (!confirm('Kustutan sõiduki "' + c.name + '" ja selle broneeringud?')) return;
      db.cars = db.cars.filter(function (x) { return x !== c; });
      db.bookings = db.bookings.filter(function (b) { return b.carId !== c.id; });
      db.services = db.services.filter(function (v) { return v.carId !== c.id; });
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
      s[k] = (k === 'motion' || k === 'fullscreen' || k === 'badge') ? v === '1' : v; save(); updBadge();
      var sib = this.parentNode.querySelectorAll('[data-seg=' + k + ']');
      for (var i = 0; i < sib.length; i++) sib[i].className = sib[i] === this ? 'sel' : '';
      applyTheme(); cam.apply();
    });
    function bind(id, key, num) {
      var el = d.querySelector('#' + id); if (!el) return;
      el.addEventListener('change', function () { s[key] = num ? +el.value : el.value; save(); applyTheme(); });
      el.addEventListener('input', function () { var v = d.querySelector('#' + id + 'v'); if (v) v.textContent = el.value; });
    }
    on(d, '#nf select, #nt select', 'change', function () { s.nightFrom = readTime(d, 'nf'); s.nightTo = readTime(d, 'nt'); save(); applyTheme(); });
    bind('lt', 'lightThreshold', true);
    bind('sens', 'sensitivity', true); bind('slp', 'sleepSec', true); bind('hs', 'halfSplit', true); bind('pin', 'pin');
    on(d, '[data-a=measure]', 'click', function () {
      if (cam.light < 0) { alert('Kaamera ei tööta – valgust ei saa mõõta.'); return; }
      s.lightThreshold = Math.round(cam.light); save();
      d.querySelector('#lt').value = s.lightThreshold; d.querySelector('#ltv').textContent = s.lightThreshold;
    });
    on(d, '[data-a=camstart]', 'click', function () { cam.testing = true; cam.start(true); });
    on(d, '[data-a=export]', 'click', exportData);
    on(d, '[data-a=import]', 'click', importData);
    var liveTimer = setInterval(function () {
      if (!document.body.contains(d)) { clearInterval(liveTimer); return; }
      var l = d.querySelector('#lnow'), c = d.querySelector('#camst');
      if (l) l.textContent = lightText(); if (c) c.textContent = cam.status;
      var mi = d.querySelector('#motInd');
      if (mi) {
        var act = cam.stream && Date.now() - cam.lastMotion < 1200;
        mi.className = 'ind' + (act ? ' on' : '') + (cam.stream ? '' : (cam.denied ? ' off' : ''));
        mi.lastChild.textContent = !cam.stream ? (cam.denied ? 'kaamera keelatud – luba seadme seadetes' : 'ootab musta ekraani (vajuta "Testi kaamerat")') :
          (act ? 'TUVASTAB liikumist' : 'liikumist pole') + '  (muutus ' + cam.md.toFixed(1) + ' / lävi ' + cam.thr.toFixed(1) + ')';
      }
    }, 250);
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
    status: 'väljas', light: -1, stream: null, timer: null, prev: null, lastMotion: 0, md: 0, thr: 0,
    startedAt: 0, testing: false, measuring: false, denied: false, starting: false,
    video: document.getElementById('cam'), canvas: document.getElementById('camCanvas'),
    // Kaamera töötab AINULT musta ekraani ajal (iOS/Android näitavad kaamera kasutamisel ikooni).
    // Erandid: seadetes "Käivita kaamera" (testimine) ja valguse lühimõõtmine ärkvel olles.
    supported: function () { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && !this.denied; },
    wanted: function () {
      var need = db.settings.motion || db.settings.themeMode === 'light';
      return (sleeping && need) || this.testing || this.measuring;
    },
    apply: function () { if (this.wanted()) this.start(false); else this.stop(); },
    start: function (userAsked) {
      var self = this;
      if (this.stream || this.starting) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.status = 'pole toetatud (vana seade?)'; return; }
      if (userAsked) this.denied = false;
      this.status = 'käivitub…'; this.starting = true;
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 160 }, height: { ideal: 120 } }, audio: false })
        .then(function (st) {
          self.starting = false;
          if (!self.wanted() && !userAsked) { st.getTracks().forEach(function (t) { t.stop(); }); self.status = 'väljas'; return; }
          self.stream = st; self.video.srcObject = st; self.startedAt = Date.now();
          var p = self.video.play(); if (p && p.catch) p.catch(function () {});
          self.status = 'töötab'; self.prev = null;
          self.timer = setInterval(function () { self.sample(); }, 500);
        })
        .catch(function (e) {
          self.starting = false;
          if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) self.denied = true;
          self.status = 'ei saa kasutada: ' + (e && e.name ? e.name : e);
          if (userAsked) alert('Kaamerat ei saanud käivitada (' + (e && e.name) + '). Luba kaamera seadme seadetes.');
        });
    },
    stop: function () {
      if (this.timer) clearInterval(this.timer); this.timer = null;
      if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); });
      // viimane valguse väärtus jääb alles (öövaade valguse järgi)
      this.stream = null; this.status = this.denied ? this.status : 'väljas (käivitub mustal ekraanil)';
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
        this.md = md; this.thr = thr;
        // esimesed 2,5 s ignoreeri – kaamera automaatsäritus muudab pilti ja annaks vale äratuse
        if (md > thr && Date.now() - this.startedAt > 2500) { this.lastMotion = Date.now(); if (db.settings.motion && sleeping) activity(); }
      }
      this.prev = cur;
    }
  };

  // ---------- Uinumine ----------
  var sleepEl = document.getElementById('sleep');
  var lastActivity = Date.now();
  var sleeping = false, sleepTimer = null;
  function goSleep() {
    if (sleeping) return; sleeping = true;
    clearTimeout(sleepTimer);
    sleepEl.className = 'show';                       // nähtav, läbipaistev
    setTimeout(function () { if (sleeping) sleepEl.className = 'show dark'; }, 30); // sujuvalt mustaks (CSS transition)
    cam.apply();                                      // kaamera sisse – ootab liikumist
  }
  function wake() {
    if (!sleeping) return; sleeping = false;
    cam.apply();                                      // kaamera välja – ikoon kaob
    render(); applyTheme(); requestWakeLock();
    sleepEl.className = 'show';                       // sujuvalt läbipaistvaks
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(function () { if (!sleeping) sleepEl.className = 'hidden'; }, 1600);
  }
  function activity() { lastActivity = Date.now(); wake(); }
  ['touchstart', 'mousedown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, activity, true);
  });
  // Puudutus mustal ekraanil ainult äratab, ei vajuta ruudule
  sleepEl.addEventListener('click', function (e) { e.stopPropagation(); });
  function checkSleep() {
    if (!db.settings.motion || !cam.supported()) return; // ilma andurita ei uinu (muidu ei ärkaks ise)
    if (!overlay.classList.contains('hidden')) return;
    if (Date.now() - lastActivity > (+db.settings.sleepSec || 120) * 1000) goSleep();
  }

  // ---------- Täisekraan (Fullscreen API) ----------
  // Paigaldatud appis (display-mode fullscreen) pole vaja. Brauseris tohib täisekraani küsida
  // ainult kasutaja puudutuse ajal, seega proovime igal puudutusel, kuni see õnnestub.
  var docEl = document.documentElement;
  function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function fsSupported() { return !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen); }
  function appFullscreen() {
    return window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches;
  }
  function enterFs() {
    if (isFs() || !fsSupported()) return;
    try {
      var r = docEl.requestFullscreen ? docEl.requestFullscreen({ navigationUI: 'hide' }) : docEl.webkitRequestFullscreen();
      if (r && r.catch) r.catch(function () {});
    } catch (e) {}
  }
  function exitFs() {
    try { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch (e) {}
  }
  // Puudutus, mis lülitab täisekraani sisse, ei tee muud (ei ava kogemata auto akent)
  // NB! Neelame ainult esimese katse puudutuse – kui brauser täisekraani ei luba, ei tohi app kasutamatuks jääda.
  var swallowClick = 0, fsTries = 0;
  function autoFs(e) {
    if (e.type === 'click' && Date.now() - swallowClick < 800) {
      swallowClick = 0; e.stopPropagation(); e.preventDefault(); return;
    }
    if (!db.settings.fullscreen || appFullscreen() || isFs() || !fsSupported()) return;
    if (e.target && e.target.closest && e.target.closest('#btnFs')) return;
    enterFs();
    if (fsTries++ > 0) return;
    if (e.type === 'touchend') swallowClick = Date.now();
    else { e.stopPropagation(); e.preventDefault(); }
  }
  ['click', 'touchend'].forEach(function (ev) { document.addEventListener(ev, autoFs, true); });
  var FS_ICON = {
    enter: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    exit: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>'
  };
  var fsBtn = document.getElementById('btnFs');
  function updFsBtn() {
    fsBtn.style.display = (fsSupported() && !appFullscreen()) ? '' : 'none';
    fsBtn.innerHTML = isFs() ? FS_ICON.exit : FS_ICON.enter;
  }
  fsBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (isFs()) { db.settings.fullscreen = false; save(); exitFs(); } else { db.settings.fullscreen = true; save(); enterFs(); }
  });
  document.addEventListener('fullscreenchange', function () { updFsBtn(); setTimeout(fitTiles, 200); });
  document.addEventListener('webkitfullscreenchange', function () { updFsBtn(); setTimeout(fitTiles, 200); });
  updFsBtn();

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
  document.getElementById('btnBook').addEventListener('click', function () { showCalendar(0); });

  setInterval(tick, 10000);
  setInterval(function () { if (overlay.classList.contains('hidden')) render(); applyTheme(); checkSleep(); }, 30000);
  setInterval(checkSleep, 1000);
  // Öövaade ruumi valguse järgi: ärkvel olles lühike mõõtmine iga 10 min (≈4 s)
  setInterval(function () {
    if (sleeping || db.settings.themeMode !== 'light' || !cam.supported() || cam.stream) return;
    cam.measuring = true; cam.apply();
    setTimeout(function () { cam.measuring = false; cam.apply(); applyTheme(); }, 4000);
  }, 600000);

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
