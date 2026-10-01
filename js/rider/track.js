// Rider side of live tracking: while a food job is active, share this phone's GPS with that order's customer (Realtime Broadcast).
const TRK = { ch: new Map(), watch: null, last: null, timer: null };

// Inside the Android app (Capacitor) GPS keeps running with the screen off, using a foreground service + notification.
const BG = () => { const c = window.Capacitor; return c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins.BackgroundGeolocation; };
const trkPush = () => { if (!TRK.last) return; TRK.ch.forEach(c => c.send({ type: "broadcast", event: "pos", payload: TRK.last })); trkShare(); trkLog(); };
function trkNative() {
  const bg = BG(); if (!bg) return false;
  TRK.watch = "native";
  bg.addWatcher({ backgroundTitle: "Biyahe is sharing your live location", backgroundMessage: "Trip in progress", requestPermissions: true, stale: false, distanceFilter: 5 }, (l, e) => {
    if (e || !l) { toast("Allow location 'All the time' so tracking works with the screen off"); return; }
    TRK.last = { lat: l.latitude, lng: l.longitude, hd: l.bearing, t: Date.now() };
    if (typeof jmMe === "function") jmMe();
    trkPush();
  }).then(id => { TRK.bgId = id; });
  TRK.timer = setInterval(trkPush, 3000);
  if (typeof wlOn === "function") wlOn();
  return true;
}

async function trkSync() {   // call whenever jobs change
  if (!me) { trkStop(); return; }
  const { data } = await sb.from("bookings").select("id,type").eq("rider_id", me.id).in("status", ["accepted", "on_the_way"]);
  const all = new Set((data || []).map(j => String(j.id)));   // every active job: the customer's trusted contact may be following it
  const ids = new Set((data || []).filter(j => j.type === "food" || j.type === "ride").map(j => String(j.id)));   // food orders and rides stream live to the customer's map
  TRK.act = all;
  for (const [id, c] of TRK.ch) if (!ids.has(id)) { sb.removeChannel(c); TRK.ch.delete(id); }
  ids.forEach(id => { if (!TRK.ch.has(id)) { const c = sb.channel("trk-" + id).on("broadcast", { event: "cust" }, m => { (TRK.cust ||= {})[id] = m.payload; if (typeof jmCust === "function") jmCust(id, m.payload); }); c.subscribe(); TRK.ch.set(id, c); } });
  if (all.size && TRK.watch == null && trkNative()) { /* native GPS started */ }
  else if (all.size && TRK.watch == null && navigator.geolocation) {
    TRK.watch = navigator.geolocation.watchPosition(p => { TRK.last = { lat: p.coords.latitude, lng: p.coords.longitude, hd: p.coords.heading, t: Date.now() }; if (typeof jmMe === "function") jmMe(); },
      () => toast("Turn on location so the customer can see you"), { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    wlOn();
    TRK.timer = setInterval(() => {
      if (!TRK.last) return;
      TRK.ch.forEach(c => c.send({ type: "broadcast", event: "pos", payload: TRK.last }));
      trkShare();
      trkLog();
    }, 3000);
  }
  if (!all.size) trkStop();
}

// Save the rider's latest point for trips a customer chose to share with a trusted contact (supabase/trip-share.sql).
// If nobody is following a trip, ask again only every 20 s so this stays cheap.
async function trkShare() {
  const now = Date.now(), nx = (TRK.sx ||= {});
  for (const id of TRK.act || []) {
    if ((nx[id] || 0) > now) continue;
    nx[id] = now + 5000;
    const { data, error } = await sb.rpc("share_update_rider", { p_booking: id, p_lat: TRK.last.lat, p_lng: TRK.last.lng });
    if (!error && data === false) nx[id] = now + 20000;
  }
}

// Route Watch: every ~10 s send the rider's point for each active job. The SERVER checks it against the planned route
// (supabase/route-watch.sql) and flags anything unusual for the owner. Nothing is decided on the phone.
async function trkLog() {
  const now = Date.now(), nx = (TRK.lx ||= {});
  for (const id of TRK.act || []) {
    if ((nx[id] || 0) > now) continue;
    nx[id] = now + 10000;
    const { error } = await sb.rpc("rider_log_point", { p_booking: id, p_lat: TRK.last.lat, p_lng: TRK.last.lng });
    if (error) nx[id] = now + 60000;   // e.g. route-watch.sql not installed yet: try again only once a minute
  }
}

function trkStop() {
  if (typeof wlOff === "function") wlOff();
  if (TRK.watch === "native") { const bg = BG(); if (bg && TRK.bgId != null) bg.removeWatcher({ id: TRK.bgId }); TRK.watch = null; TRK.bgId = null; }
  else if (TRK.watch != null) { navigator.geolocation.clearWatch(TRK.watch); TRK.watch = null; }
  if (TRK.timer) { clearInterval(TRK.timer); TRK.timer = null; }
  TRK.ch.forEach(c => sb.removeChannel(c)); TRK.ch.clear(); TRK.last = null; TRK.cust = {}; TRK.act = new Set(); TRK.sx = {}; TRK.lx = {};
}
