// Ride tab map: a real map (Leaflet + OpenStreetMap tiles, like Google Maps).
//  1. Tap "Start", then tap the map (or type an address, or use the GPS button) to place your pick-up pin.
//  2. Tap "Finish", then tap the map (or type an address) to place your drop-off pin. Pins can be dragged.
//  3. Pick a vehicle and book. Nearby riders and your GPS position then appear on the map,
//     a rider is matched, and the booking is confirmed.
// Nearby riders are simulated while waiting. Once a REAL rider accepts, their live GPS (rmLive) drives the map and only the rider's taps move the trip.
const RM_CENTER = [12.3527, 121.0675];   // fallback view (San Jose, Occidental Mindoro) if GPS is unavailable
const RM_SEED = [["Kuya Ben", "Motorcycle", "NBC 4821", 4.8], ["Ate Liza", "Motorcycle", "TXR 3390", 4.9], ["Mang Rudy", "Tricycle", "7412 QW", 4.6], ["Joel", "Motorcycle", "ABC 1027", 4.7],
  ["Marites", "Car", "DKP 5583", 4.9], ["Carlo", "Tricycle", "5290 LM", 4.5], ["Nene", "Motorcycle", "WQT 6614", 4.8], ["Dodong", "Car", "NFA 2276", 4.4]];
const RM_SAMPLES = false;   // true = show pretend riders driving around while waiting. Off: the map stays empty until a REAL rider accepts.
const RM_MPM = 280;   // metres per minute used for rider ETAs (~17 km/h in town traffic)
const rmFresh = () => ({ map: null, a: null, b: null, am: null, bm: null, line: null, rline: null, radar: null, gm: null, gc: null, watch: null,
  txt: { a: "", b: "" }, km: null, min: null, mode: "a", locked: false, routeSeq: 0, riders: [], trip: null, real: null, timers: [], raf: 0, last: 0, tickAt: 0, sug: [], sugT: 0, ro: [], pkey: "" });
const RM = rmFresh();
const rmEl = s => document.querySelector(s);
const rmLL = p => [p.lat, p.lng];
const rmR = (a, b) => a + Math.random() * (b - a);
const rmAt = (fn, ms) => RM.timers.push(setTimeout(fn, ms));

function rmDist(a, b) {   // metres
  const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lng - a.lng) * t;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(x));
}
function rmOff(p, m, br) {
  return { lat: p.lat + Math.cos(br) * m / 111320, lng: p.lng + Math.sin(br) * m / (111320 * Math.cos(p.lat * Math.PI / 180)) };
}
const rmEta = r => Math.max(1, Math.ceil(rmDist(r, RM.a) / RM_MPM));

// ---------- Markers ----------
const rmPin = k => L.divIcon({ className: "", html: `<div class="rm-pin ${k}"><i></i></div><span class="rm-pl ${k}">${k === "a" ? "Start" : "Finish"}</span>`, iconSize: [28, 28], iconAnchor: [14, 34] });
const rmRiderIcon = v => vhIcon(v);   // top-down Motorcycle / Tricycle / Car (js/vehicle.js)

// ---------- Choosing Start / Finish ----------
function rmMode(k) {
  RM.mode = k;
  document.querySelectorAll(".rf").forEach(f => f.classList.toggle("on", f.dataset.k === k));
  rmHint();
}
function rmHint() {
  const h = rmEl("#rhint");
  h.hidden = RM.locked;
  h.textContent = RM.a && RM.b ? "Drag a pin or tap the map to adjust" : RM.mode === "a" ? "Tap the map to set your Start" : "Tap the map to set your Finish";
}

function rmSet(k, ll, o = {}) {
  const p = { lat: ll.lat, lng: ll.lng }, mk = k + "m";
  RM[k] = p;
  if (RM[mk]) RM[mk].setLatLng(rmLL(p));
  else {
    RM[mk] = L.marker(rmLL(p), { icon: rmPin(k), draggable: true, keyboard: false, zIndexOffset: 500 }).addTo(RM.map);
    RM[mk].on("dragend", e => rmSet(k, e.target.getLatLng()));
  }
  const inp = rmEl(k === "a" ? "#rp" : "#rd");
  RM.txt[k] = o.text || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  if (o.text) inp.value = o.text;
  else { inp.value = "Finding address…"; rmReverse(p).then(t => { if (RM[k] === p) { RM.txt[k] = t; inp.value = t; } }); }
  rmMode(k === "a" && !RM.b ? "b" : k);
  if (o.pan || !rmVisible(p)) rmFit(p);
  rmRoute();
}

function rmDrop(k) {   // the person is typing a new address: forget the old pin
  const mk = k + "m";
  if (RM[mk]) { RM[mk].remove(); RM[mk] = null; }
  RM[k] = null; RM.txt[k] = "";
  rmRoute();
}

function rmVisible(p) {   // is the point on screen and not hidden behind the booking sheet?
  const s = RM.map.getSize(), c = RM.map.latLngToContainerPoint(rmLL(p)), h = rmEl("#rsheet").offsetHeight;
  return c.x > 20 && c.x < s.x - 20 && c.y > 60 && c.y < s.y - h - 30;
}
function rmFit(p) {   // bring one point (or both pins) into the free part of the map above the sheet
  const h = rmEl("#rsheet").offsetHeight, pts = RM.a && RM.b ? [RM.a, RM.b] : [p || RM.a || RM.b].filter(Boolean);
  if (!pts.length) return;
  if (pts.length === 1) {
    const z = Math.max(RM.map.getZoom(), 16), pp = RM.map.project(rmLL(pts[0]), z).add([0, h / 2]);
    RM.map.setView(RM.map.unproject(pp, z), z);
  } else RM.map.fitBounds(L.latLngBounds(pts.map(rmLL)), { paddingTopLeft: [40, 60], paddingBottomRight: [40, h + 30], maxZoom: 17 });
}

// ---------- Address lookup (OpenStreetMap Nominatim) ----------
async function rmReverse(p) {
  const fb = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=en&lat=${p.lat}&lon=${p.lng}`);
    const j = await r.json(), a = j.address || {};
    const parts = [a.road || a.pedestrian || a.footway || j.name, a.suburb || a.village || a.neighbourhood || a.hamlet || a.quarter, a.city || a.town || a.municipality || a.county]
      .filter((x, i, l) => x && l.indexOf(x) === i);
    return parts.length ? parts.slice(0, 3).join(", ") : (j.display_name || fb).split(",").slice(0, 3).join(",").trim();
  } catch (e) { return fb; }
}

const RM_IC = {
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.500C19 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/></svg>',
  gps: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>',
  map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.500"/><path d="M12 7v5l3 2"/></svg>'
};
function rmSug(list, msg) {   // list = [{text, ll} | {text, act}], msg = a status line under the list ("Searching…", "No results…")
  RM.sug = list;
  const box = rmEl("#rsug");
  box.hidden = !list.length && !msg;
  box.innerHTML = list.map((s, i) => `<button type="button" data-i="${i}"><i class="rsug-ic">${RM_IC[s.ic || "pin"]}</i><span>${esc(s.text)}</span></button>`).join("") + (msg ? `<div class="rsug-msg">${esc(msg)}</div>` : "");
}

// Recently used places are remembered on this device.
const rmRecent = () => { try { return JSON.parse(localStorage.getItem("biyahe-recent") || "[]"); } catch (e) { return []; } };
function rmRemember(s) {
  if (!s.ll || !s.text) return;
  try { localStorage.setItem("biyahe-recent", JSON.stringify([{ ll: s.ll, text: s.text }, ...rmRecent().filter(x => x.text !== s.text)].slice(0, 5))); } catch (e) { /* storage blocked */ }
}
function rmDefaults(k) {   // shown when a field is focused and empty: quick picks + recent places
  return [k === "a" ? { text: "Use my current location", act: "gps", ic: "gps" } : null, { text: "Choose on the map", act: "map", ic: "map" },
    ...rmRecent().map(x => ({ ...x, ic: "clock" }))].filter(Boolean);
}

// Search: OpenStreetMap Nominatim near the map first, then all of the Philippines, then Photon as a backup.
async function rmLookup(q) {
  const c = RM.map.getCenter(), vb = [c.lng - .6, c.lat + .6, c.lng + .6, c.lat - .6].join(","), e = encodeURIComponent(q);
  const nom = x => x.map(o => ({ ll: { lat: +o.lat, lng: +o.lon }, text: o.display_name.split(",").slice(0, 3).join(",").trim() }));
  const pho = j => (j.features || []).filter(f => !f.properties.countrycode || f.properties.countrycode === "PH").map(f => {
    const p = f.properties, t = [p.name, p.street, p.district || p.locality, p.city || p.county].filter((v, i, l) => v && l.indexOf(v) === i).slice(0, 3).join(", ");
    return { ll: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }, text: t || p.state || q };
  });
  const src = [
    [`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=ph&accept-language=en&viewbox=${vb}&q=${e}`, nom],
    [`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=ph&accept-language=en&q=${e}`, nom],
    [`https://photon.komoot.io/api/?limit=6&lang=en&lat=${c.lat}&lon=${c.lng}&q=${e}`, pho]];
  let failed = 0;
  for (const [url, fn] of src) {
    try {
      const r = await fetch(url); if (!r.ok) throw new Error(r.status);
      const list = fn(await r.json());
      if (list.length) return { list };
    } catch (err) { failed++; }
  }
  return { list: [], failed: failed === src.length };
}
async function rmSuggest(k, q) {
  const inp = rmEl(k === "a" ? "#rp" : "#rd");
  rmSug([], "Searching…");
  const { list, failed } = await rmLookup(q);
  if (inp.value.trim() !== q) return;   // they kept typing
  rmSug(list, list.length ? "" : failed ? "Search isn't available right now. Tap the map to set the spot." : "No places found. Try another name, or tap the map.");
}
function rmPick(k, s) {
  if (!s) return;
  if (s.act === "gps") { rmSug([]); rmMode("a"); rmLocate(false); document.activeElement.blur(); return; }
  if (s.act === "map") { rmSug([]); rmMode(k); document.activeElement.blur(); toast(k === "a" ? "Tap the map to set your Start" : "Tap the map to set your Finish"); return; }
  rmSug([]); rmRemember(s); rmSet(k, s.ll, { text: s.text, pan: true }); document.activeElement.blur();
}

// ---------- Route line + distance (OSRM), used for the fare ----------
async function rmRoute() {
  const seq = ++RM.routeSeq;
  if (RM.line) { RM.line.remove(); RM.line = null; }
  RM.km = RM.min = null;
  if (RM.a && RM.b) {
    const a = RM.a, b = RM.b;
    RM.km = rmDist(a, b) * 1.3 / 1000; RM.min = Math.max(1, Math.round(RM.km / .3));   // estimate until the road route arrives
    RM.line = L.polyline([rmLL(a), rmLL(b)], { color: accent(), weight: 4, opacity: .55, dashArray: "2 9" }).addTo(RM.map);
    try {
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`);
      const rt = (await r.json()).routes?.[0];
      if (rt && seq === RM.routeSeq) {
        RM.km = rt.distance / 1000; RM.min = Math.max(1, Math.round(rt.duration / 60));
        RM.line.remove();
        RM.line = L.polyline(rt.geometry.coordinates.map(([x, y]) => [y, x]), { color: accent(), weight: 5, opacity: .9 }).addTo(RM.map);
      }
    } catch (e) { /* keep the straight-line estimate */ }
  }
  if (seq === RM.routeSeq) { rmHint(); renderVeh(); }
}

// ---------- GPS ----------
function rmLocate(quiet) {
  if (!navigator.geolocation) { if (!quiet) toast("This device has no GPS. Tap the map instead."); return; }
  navigator.geolocation.getCurrentPosition(p => {
    if (!RM.map) return;
    const ll = { lat: p.coords.latitude, lng: p.coords.longitude };
    if (RM.locked) RM.map.setView(rmLL(ll), Math.max(RM.map.getZoom(), 16));
    else rmSet("a", ll, { pan: true });
  }, err => { if (!quiet) toast(err.code === 1 ? "Location permission is off. Tap the map to set your start." : "Couldn't get your location. Tap the map instead."); },
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
}

function rmWatch(on) {   // live blue GPS dot while a booking is on the map
  if (RM.watch != null) { navigator.geolocation.clearWatch(RM.watch); RM.watch = null; }
  if (RM.gm) { RM.gm.remove(); RM.gm = null; } if (RM.gc) { RM.gc.remove(); RM.gc = null; }
  if (!on || !navigator.geolocation) return;
  RM.watch = navigator.geolocation.watchPosition(p => {
    if (!RM.map) return;
    const ll = [p.coords.latitude, p.coords.longitude], acc = p.coords.accuracy;
    if (!RM.gm) RM.gm = L.marker(ll, { icon: L.divIcon({ className: "", html: `<div class="rm-me"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false, zIndexOffset: 100 }).addTo(RM.map);
    else RM.gm.setLatLng(ll);
    if (RM.gc) { RM.gc.remove(); RM.gc = null; }
    if (acc <= 300) RM.gc = L.circle(ll, { radius: acc, color: accent(), weight: 1, fillOpacity: .1, interactive: false }).addTo(RM.map);
  }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}

// ---------- After booking: nearby riders, matching, rider drives to you ----------
function rmLock(on) {
  RM.locked = on;
  rmEl("#rmap").classList.toggle("locked", on);
  ["am", "bm"].forEach(m => { const d = RM[m] && RM[m].dragging; if (d) on ? d.disable() : d.enable(); });
  rmEl("#rplan").hidden = on; rmEl("#rtrip").hidden = !on;
  rmHint();
}

// Road-following riders: nearby riders only ever appear on (and drive along) real roads, so none sit in the sea or jump around.
async function rmRoad(a, b) {   // OSRM road route a -> b as [[lat,lng],...], or null when it can't be found
  try {
    const rt = (await (await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`)).json()).routes?.[0];
    return rt && rt.geometry.coordinates.length > 1 ? rt.geometry.coordinates.map(([x, y]) => [y, x]) : null;
  } catch (e) { return null; }
}
async function rmPatrol(r) {   // give the rider its next stretch of road (a fresh random route, or the same road backwards)
  if (r.busy) return; r.busy = true;
  for (let i = 0; i < 3; i++) {
    const from = r.ready ? { lat: r.lat, lng: r.lng } : rmOff(RM.a, rmR(120, 650), rmR(0, 6.283)), to = rmOff(RM.a, rmR(100, 750), rmR(0, 6.283));
    const pts = await rmRoad(from, to);
    if (!RM.riders.includes(r) || !RM.a) return;   // the trip was closed meanwhile
    const path = pts && vhPath(pts);
    if (!path || path.len < 120 || path.len > 2200) continue;   // too short, or the road goes a long way round (water in between)
    r.path = path; r.s = 0; r.spd = rmR(5, 8);
    const q = vhAt(path, 0); r.lat = q.lat; r.lng = q.lng;
    if (!r.ready) {
      r.ready = true; r.m.setLatLng(rmLL(r)).addTo(RM.map); vhAim(r.m, q.brg);
      if (RM.trip && RM.trip.phase === "search" && r.veh === RM.trip.veh) rmMark(r, "hot", true);
    }
    r.busy = false; return;
  }
  if (r.ready && r.path) { r.path = vhPath([...r.path.pts].reverse()); r.s = 0; }   // no new road found: drive back the way it came
  else if ((r.tries = (r.tries || 0) + 1) < 4) rmAt(() => rmPatrol(r), 3000);       // still not on a road: try again shortly
  r.busy = false;
}

function rmSpawn(veh) {
  const seeds = [...RM_SEED].sort((x, y) => (y[1] === veh) - (x[1] === veh));   // the vehicle you booked comes first
  RM.riders = seeds.map(([name, v, plate, rate]) => {
    const r = { name, veh: v, plate, rate, lat: RM.a.lat, lng: RM.a.lng, ready: false, busy: false, path: null, s: 0, spd: 6 };
    r.m = L.marker(rmLL(r), { icon: rmRiderIcon(v), zIndexOffset: 300 });   // added to the map once it is on a road
    r.m.bindTooltip(() => `${r.name} · ★ ${r.rate} · ${rmEta(r)} min`, { direction: "top", offset: [0, -24] });
    return r;
  });
  RM.riders.forEach(rmPatrol);
}
const rmMark = (r, cls, on) => { const e = r.m.getElement(); if (e && e.firstChild) e.firstChild.classList.toggle(cls, on); };

function rmBooked(veh) {
  rmEnd(true);
  rmLock(true);
  RM.radar = L.marker(rmLL(RM.a), { icon: L.divIcon({ className: "", html: `<div class="rm-radar"></div>`, iconSize: [0, 0], iconAnchor: [0, 0] }), interactive: false, zIndexOffset: -200 }).addTo(RM.map);
  rmWatch(true);
  if (RM_SAMPLES) rmSpawn(veh);   // optional pretend riders; nobody accepts automatically either way
  RM.riders.filter(r => r.veh === veh).forEach(r => rmMark(r, "hot", true));
  RM.trip = { phase: "search", veh, total: 1 };
  rmPanel(true);
  const h = rmEl("#rsheet").offsetHeight;
  RM.map.fitBounds(L.latLngBounds([RM.a, ...RM.riders.filter(r => r.ready)].map(rmLL)), { paddingTopLeft: [40, 60], paddingBottomRight: [40, h + 30], maxZoom: 16 });
  rmLive(RM.bid);
}

// ---------- The real rider ----------
// After booking, the screen follows the REAL booking. The rider accepts in the rider app, their GPS arrives over the
// same Realtime channel food orders use ("trk-<id>", sent by js/rider/track.js), and only the rider's own taps
// (Start trip, Mark done) move the trip forward. Nothing starts by itself.
const RM_ARRIVE_M = 100;   // the rider counts as "arrived" inside this distance of your Start pin

function rmLive(id) {
  rmLiveStop();
  id = String(id);
  const rl = RM.real = { id, b: null, pos: null, mk: null, line: null, rs: 0, rt: 0, bc: null, pc: null };
  rl.bc = sb.channel("rmb-" + id).on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: "id=eq." + id }, p => rmStatus(p.new))
    .subscribe(s => { if (s === "SUBSCRIBED") rmPull(id); });
  rl.pc = sb.channel("trk-" + id).on("broadcast", { event: "pos" }, m => rmRiderPos(m.payload)).subscribe();
}
async function rmPull(id) {   // catch up in case the rider accepted before we were listening
  const { data } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
  if (data && RM.real && RM.real.id === String(id)) rmStatus(data);
}
function rmLiveStop() {
  const rl = RM.real; if (!rl) return;
  [rl.bc, rl.pc].forEach(c => c && sb.removeChannel(c));
  if (rl.mk) rl.mk.remove();
  if (rl.line) rl.line.remove();
  RM.real = null;
}
const rmVeh = () => (RM.real && (RIDERS.get(RM.real.id)?.vehicle || RM.real.b?.details?.vehicle)) || RM.trip?.veh || "Motorcycle";

function rmStatus(b) {   // the booking changed (rider accepted, started the trip, finished, or it was cancelled)
  const rl = RM.real, tr = RM.trip;
  if (!rl || !tr || String(b.id) !== rl.id) return;
  rl.b = b;
  if (b.status === "cancelled") { toast("This booking was cancelled"); rmEnd(); return; }
  if (b.status === "searching") return;
  if (tr.phase === "search") rmAccepted();
  if (b.status === "on_the_way" && tr.phase !== "trip" && tr.phase !== "done") rmTripStart();   // only when the RIDER taps Start trip
  if (b.status === "done" && tr.phase !== "done") rmDone();
}

function rmAccepted() {   // a real rider took the job: the sample riders disappear, the real one takes over
  const tr = RM.trip;
  RM.timers.forEach(clearTimeout); RM.timers = [];
  RM.riders.forEach(r => r.m.remove()); RM.riders = [];
  if (RM.radar) { RM.radar.remove(); RM.radar = null; }
  Object.assign(tr, { phase: "go", tphase: null, total: 0, left: null });
  RM.pkey = "";
  toast("A rider accepted your booking");
  rmPanel(true);
  loadRiders().then(() => { if (RM.trip === tr) { RM.pkey = ""; rmPanel(true); } });   // name + plate
  if (RM.real.pos) rmRiderPos(RM.real.pos);
}

function rmRiderPos(p) {   // a live GPS point from the rider
  const rl = RM.real, tr = RM.trip;
  if (!rl || !tr || !p || p.lat == null || !RM.map) return;
  rl.pos = p;
  if (tr.phase === "search" || tr.phase === "done") return;
  const ll = [p.lat, p.lng], phase = tr.phase, tgt = phase === "trip" ? RM.b : RM.a, m = rmDist(p, tgt);
  if (rl.mk) vhPlace(rl.mk, ll);
  else {
    rl.mk = L.marker(ll, { icon: vhIcon(rmVeh(), { glide: true, box: true, hot: true }), zIndexOffset: 400 }).addTo(RM.map);
    vhAim(rl.mk, vhBrg(p, tgt));
    rmFitTo([RM.a, p]);
  }
  if (tr.tphase !== phase) { tr.tphase = phase; tr.total = Math.max(m, 1); }   // progress bar starts from here
  tr.left = m;
  if (phase === "go" && m <= RM_ARRIVE_M) {   // close to your Start pin. The trip still waits for the rider to tap Start trip.
    tr.phase = "arrived";
    if (rl.line) { rl.line.remove(); rl.line = null; }
    if (typeof ntPush === "function") ntPush("scooter", "Your rider has arrived", "Meet your rider at your pickup point.", true);   // bell entry + toast
    else toast("Your rider has arrived");
    if (typeof ntAlarm === "function") ntAlarm(4000);   // loud 4-second alert + vibration so you don't miss them
    rmPanel(true);
    return;
  }
  if (phase === "go" && Date.now() - rl.rt > 15000) { rl.rt = Date.now(); rmRiderRoute(); }
}
async function rmRiderRoute() {   // road route from the rider to you, while they drive to your Start pin
  const rl = RM.real, tr = RM.trip;
  if (!rl || !rl.pos || !tr || tr.phase !== "go") return;
  const seq = ++rl.rs, pts = await rmRoad(rl.pos, RM.a);
  if (!pts || RM.real !== rl || seq !== rl.rs || RM.trip.phase !== "go") return;
  if (rl.line) rl.line.remove();
  rl.line = L.polyline(pts, { color: "#178a4c", weight: 5, opacity: .85 }).addTo(RM.map);
}
function rmFitTo(list) {
  const pts = list.filter(Boolean).map(rmLL);
  if (RM.map && pts.length) RM.map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 60], paddingBottomRight: [40, rmEl("#rsheet").offsetHeight + 30], maxZoom: 17 });
}

function rmTripStart() {   // the rider tapped Start trip
  const tr = RM.trip, rl = RM.real;
  Object.assign(tr, { phase: "trip", tphase: null, total: 0, left: null });
  if (rl && rl.line) { rl.line.remove(); rl.line = null; }
  RM.pkey = "";
  toast("Your rider started the trip");
  rmPanel(true);
  rmFitTo([RM.a, RM.b]);
  if (rl && rl.pos) rmRiderPos(rl.pos);
}
function rmDone() {   // the rider tapped Mark done
  const tr = RM.trip, rl = RM.real;
  tr.phase = "done"; RM.pkey = "";
  if (rl && rl.line) { rl.line.remove(); rl.line = null; }
  rmPanel(true);
}

// Re-open a booking that is already in progress (after a reload, or from the Activity tab).
function rmResume(b) {
  const g = b.details || {};
  if (!RM.map || !g.pickup_geo || !g.dropoff_geo) return false;
  rmEnd(true);
  rmSet("a", g.pickup_geo, { text: b.pickup, pan: true });
  rmSet("b", g.dropoff_geo, { text: b.dropoff });
  RM.bid = b.id;
  rmLock(true); rmWatch(true);
  RM.trip = { phase: "search", veh: g.vehicle || "Motorcycle", total: 1 };
  rmPanel(true);
  rmLive(b.id);
  return true;
}

function rmEnd(silent) {   // clear the trip from the map; keep the start pin, clear the finish
  RM.timers.forEach(clearTimeout); RM.timers = [];
  rmLiveStop();
  RM.riders.forEach(r => r.m.remove()); RM.riders = [];
  if (RM.rline) { RM.rline.remove(); RM.rline = null; }
  if (RM.radar) { RM.radar.remove(); RM.radar = null; }
  RM.trip = null; RM.pkey = "";
  if (silent) return;
  RM.bid = null;
  rmWatch(false);
  rmLock(false);
  rmEl("#rd").value = ""; RM.txt.b = "";
  if (RM.bm) { RM.bm.remove(); RM.bm = null; } RM.b = null;
  rmMode("b"); rmRoute();
}

function rmPanel(force) {
  const tr = RM.trip, box = rmEl("#rtrip");
  if (!tr) { box.innerHTML = ""; return; }
  const key = tr.phase, rid = RM.real && RM.real.id, info = rid && RIDERS.get(rid);
  if (force || key !== RM.pkey) {
    RM.pkey = key;
    const same = RM.riders.filter(x => x.veh === tr.veh).length, moving = tr.phase === "go" || tr.phase === "trip";
    const ok = (t, s) => `<div class="rt-ok"><span class="rt-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><div><b>${t}</b><small>${s}</small></div></div>`;
    const who = tr.phase === "search" ? "" : `<div class="rt rt-rider"><span class="rk-av vh-th">${vhSvg(info?.vehicle || rmVeh())}</span><div><b>${info ? esc(info.rider_name) : "Your rider"}</b><small>${info ? `${esc(info.vehicle || rmVeh())} · ${esc(info.plate)}${info.review_count ? " · ★ " + info.avg_rating : ""}` : esc(rmVeh())}</small></div>${moving ? `<div class="rt-eta"><b id="rteta">–</b><small>${tr.phase === "go" ? "away" : "to go"}</small></div>` : ""}</div>`;
    box.innerHTML = tr.phase === "search"
      ? `<div class="rt"><span class="rt-spin"></span><div><b>Ride booked. Waiting for a rider to accept…</b><small>${RM.riders.length ? `${RM.riders.length} sample riders shown nearby · ${same} ${tr.veh.toLowerCase()} in range` : "Your booking is open to riders now. It updates here when one accepts."}</small></div></div>${RM.riders.length ? `<small class="rt-note">Riders on the map are samples until a real rider accepts your booking.</small>` : ""}`
      : tr.phase === "go" ? `${ok("Rider accepted", "Your rider is on the way")}${who}<div class="rt-bar"><i id="rtbar"></i></div><small class="rt-note" id="rtnote"></small>`
      : tr.phase === "arrived" ? `${ok("Your rider has arrived", "Waiting for your rider to start the trip")}${who}<small class="rt-note">The trip begins when your rider taps Start trip.</small>`
      : tr.phase === "trip" ? `${ok("Trip started", "Heading to " + esc(RM.txt.b))}${who}<div class="rt-bar"><i id="rtbar"></i></div>`
      : `${ok("You've arrived", "Thanks for riding with Biyahe")}${who}${rid ? `<button class="cta" type="button" data-rate="1">Rate your rider</button>` : ""}<button class="cta alt" type="button" data-done="1">Done</button>`;
    if (RM.bid && tr.phase !== "done") box.insertAdjacentHTML("beforeend", shareBar(RM.bid));   // "Share my trip" (share.js)
  }
  if (tr.phase === "go" || tr.phase === "trip") {
    const eta = rmEl("#rteta"), bar = rmEl("#rtbar"), note = rmEl("#rtnote"), has = tr.left != null;
    if (eta) eta.textContent = has ? Math.max(1, Math.ceil(tr.left / RM_MPM)) + " min" : "–";
    if (bar) bar.style.width = has && tr.total ? Math.max(0, Math.min(100, Math.round((1 - tr.left / tr.total) * 100))) + "%" : "0%";
    if (note) note.textContent = has ? "Your rider's live location is on the map." : "Waiting for your rider's GPS…";
  }
}

function rmFrame(t) {
  RM.raf = requestAnimationFrame(rmFrame);
  const dt = Math.min(.05, (t - (RM.last || t)) / 1000); RM.last = t;
  if (RM.a) for (const r of RM.riders) {   // sample riders cruise along their own stretch of road
    if (!r.ready || !r.path) continue;
    r.s += r.spd * dt;
    const q = vhAt(r.path, r.s);
    r.lat = q.lat; r.lng = q.lng; r.m.setLatLng(rmLL(r)); vhAim(r.m, q.brg);
    if (r.s >= r.path.len) rmPatrol(r);
  }
  if (t - RM.tickAt > 500) { RM.tickAt = t; rmPanel(false); }
}

// ---------- Start / stop (called when the customer screen opens and closes) ----------
function rideStart() {
  if (RM.map) return;
  RM.map = L.map("rmap", { zoomControl: false }).setView(RM_CENTER, 14);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(RM.map);
  L.control.zoom({ position: "topright" }).addTo(RM.map);
  RM.map.on("click", e => { if (RM.locked) return; rmSug([]); if (document.activeElement) document.activeElement.blur(); rmSet(RM.mode, e.latlng); });
  // The screen starts hidden behind the login: keep the map sized to its box, and keep attribution above the sheet.
  const mapRO = new ResizeObserver(() => RM.map && RM.map.invalidateSize());
  const sheetRO = new ResizeObserver(() => rmEl("#ride").style.setProperty("--sh", rmEl("#rsheet").offsetHeight + "px"));
  mapRO.observe(rmEl("#rmap")); sheetRO.observe(rmEl("#rsheet")); RM.ro = [mapRO, sheetRO];
  rmMode("a"); rmRoute(); rmLocate(true);
  RM.last = 0; RM.raf = requestAnimationFrame(rmFrame);
}

function rideStop() {
  if (!RM.map) return;
  cancelAnimationFrame(RM.raf);
  RM.timers.forEach(clearTimeout);
  rmLiveStop();
  rmWatch(false);
  RM.ro.forEach(o => o.disconnect());
  RM.map.remove();
  Object.assign(RM, rmFresh());
  ["#rp", "#rd"].forEach(s => rmEl(s).value = "");
  rmSug([]); rmEl("#rplan").hidden = false; rmEl("#rtrip").hidden = true; rmEl("#rtrip").innerHTML = "";
  rmEl("#rmap").classList.remove("locked");
  renderVeh();
}

// ---------- Inputs and taps ----------
["a", "b"].forEach(k => {
  const inp = rmEl(k === "a" ? "#rp" : "#rd"), go = () => {
    const q = inp.value.trim();
    if (q.length < 2) { toast("Type a place name to search"); inp.focus(); return; }
    clearTimeout(RM.sugT); rmMode(k); rmSuggest(k, q);
  };
  inp.addEventListener("focus", () => { if (!RM.map || RM.locked) return; rmMode(k); if (!inp.value.trim()) rmSug(rmDefaults(k)); });
  inp.addEventListener("input", () => {
    if (!RM.map) return;
    if (RM[k]) rmDrop(k);
    clearTimeout(RM.sugT);
    const q = inp.value.trim();
    if (!q) { rmSug(rmDefaults(k)); return; }
    if (q.length < 3) { rmSug([]); return; }
    RM.sugT = setTimeout(() => rmSuggest(k, q), 400);
  });
  inp.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const first = RM.sug.find(x => x.ll);
    if (first && inp.value.trim().length >= 3 && !RM[k]) rmPick(k, first); else go();
  });
  rmEl(`[data-go="${k}"]`).onclick = go;
});
rmEl("#rsug").onclick = e => { const b = e.target.closest("button"); if (b) rmPick(RM.mode, RM.sug[+b.dataset.i]); };
rmEl("#rloc").onclick = () => { if (RM.map) rmLocate(false); };
rmEl("#rtrip").onclick = e => {
  if (e.target.closest("[data-rate]")) { const id = RM.bid; rmEnd(); if (id) openReview(id); }
  else if (e.target.closest("[data-done],[data-close]")) rmEnd();
};

// Recolor the route and GPS circle when the accent color changes.
document.addEventListener("themechange", () => { if (RM.line) RM.line.setStyle({ color: accent() }); if (RM.gc) RM.gc.setStyle({ color: accent() }); });
