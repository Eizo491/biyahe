// Live food-order tracking: restaurant + your address, the rider's live GPS (broadcast by rider/track.js) and a status timeline.
const TK_STEPS = ["Order placed", "Rider heading to the restaurant", "Rider at the restaurant", "On the way to you", "Delivered"];
const tkStage = b => b.status === "done" ? 4 : b.status === "on_the_way" ? 3 : b.status === "accepted" ? (b.details?.stage === "at_rest" ? 2 : 1) : 0;
const TK = {};
const tkIcon = (k, t) => L.divIcon({ className: "", html: `<div class="rm-pin ${k}"><i></i></div><span class="rm-pl ${k}">${t}</span>`, iconSize: [28, 28], iconAnchor: [14, 34] });
const tkTarget = () => tkStage(TK.b) < 3 ? TK.b.details.restaurant.geo : TK.b.details.dropoff_geo;   // where the rider is heading now
const tkEta = () => {
  const s = tkStage(TK.b);
  if (s === 0) return "Waiting for a rider to accept";
  if (s === 4) return "Delivered";
  if (!TK.pos) return "Waiting for the rider's GPS…";
  if (s === 2) return "Rider is collecting your order";
  const m = rmDist(TK.pos, tkTarget());
  if (s === 3 && m <= 100) return "Your rider has arrived";
  return `${Math.max(1, Math.ceil(m / RM_MPM))} min away · ${(m / 1000).toFixed(1)} km`;
};

async function openTrack(id) {
  closeTrack();
  const { data: b } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
  const rg = b?.details?.restaurant?.geo, cg = b?.details?.dropoff_geo;
  if (!rg || !cg) { toast("Tracking isn't available for this order"); return; }
  Object.assign(TK, { b, id: String(id), stage: -1, pos: null, rs: 0, rt: 0 });
  $("#track").classList.add("on");
  TK.map = L.map("tmap", { zoomControl: false }).setView([cg.lat, cg.lng], 15);
  biyaheTiles().addTo(TK.map);
  TK.rm = L.marker([rg.lat, rg.lng], { icon: tkIcon("", "Restaurant") }).addTo(TK.map);
  TK.cm = L.marker([cg.lat, cg.lng], { icon: tkIcon("b", "You") }).addTo(TK.map);
  TK.ch = sb.channel("trk-" + TK.id).on("broadcast", { event: "pos" }, m => tkPos(m.payload)).subscribe();   // rider GPS
  TK.bc = sb.channel("tkb-" + TK.id).on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: "id=eq." + TK.id }, p => { TK.b = p.new; tkRender(); }).subscribe();   // status
  if (navigator.geolocation) TK.watch = navigator.geolocation.watchPosition(p => { TK.me = { lat: p.coords.latitude, lng: p.coords.longitude }; }, () => {}, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
  TK.timer = setInterval(() => { const s = TK.b ? tkStage(TK.b) : 0; if (TK.me && s >= 1 && s <= 3 && TK.ch) TK.ch.send({ type: "broadcast", event: "cust", payload: TK.me }); }, 3000);   // your live location -> the rider
  tkRender();
  setTimeout(() => { if (TK.map) { TK.map.invalidateSize(); tkFit(); } }, 60);
}

function tkRender() {
  const b = TK.b, s = tkStage(b), rn = esc(b.details?.restaurant?.name || "the restaurant"), box = $("#tsheet");
  if (b.status === "cancelled") { box.innerHTML = `<div class="rt"><div><b>Order cancelled</b></div></div><button type="button" class="cta alt" data-tkx>Close</button>`; return; }
  const head = ["Finding a rider for your order…", `Your rider is heading to ${rn}`, `Your rider is at ${rn} picking up your order`, "Your rider is on the way to you", "Delivered. Enjoy your meal!"][s];
  box.innerHTML = `<div class="rt">${s < 4 ? `<span class="rt-spin"></span>` : `<span class="rt-check">${ico("check")}</span>`}<div><b>${head}</b><small id="tketa">${tkEta()}</small></div></div>${s >= 1 ? riderCard(TK.id, s === 4) : ""}${s >= 1 && s < 4 ? `<small class="rt-note">Your rider can see your live location while this screen is open.</small>` : ""}
    ${s < 4 ? shareBar(TK.id) : ""}
    <ol class="tk-steps">${TK_STEPS.map((t, i) => `<li class="${i < s ? "done" : i === s ? "now" : ""}">${t}</li>`).join("")}</ol>
    ${s === 4 ? (b.rider_id ? `<button type="button" class="cta" data-rate>Rate your rider</button>` : "") + `<button type="button" class="cta alt" data-tkx>Close</button>` : `<button type="button" class="cta alt" data-tkx>Hide · track again from Activity</button>`}`;
  if (s >= 1 && b.rider_id && !RIDERS.has(TK.id) && !TK.rq) {   // a rider just accepted: fetch their name + plate, then redraw
    TK.rq = true; const id = TK.id;
    loadRiders().then(() => { if (TK.id === id) { TK.rq = false; if (RIDERS.has(id)) tkRender(); } });
  }
  if (s !== TK.stage) { TK.stage = s; if (TK.line) { TK.line.remove(); TK.line = null; } if (TK.pos) tkRoute(); tkFit(); }
}

function tkPos(p) {   // a live GPS point from the rider
  if (!TK.map) return;
  const first = !TK.pos, ll = [p.lat, p.lng]; TK.pos = p;
  if (TK.dm) vhPlace(TK.dm, ll);
  else { TK.dm = L.marker(ll, { icon: vhIcon("Motorcycle", { glide: true, box: true, hot: true }), zIndexOffset: 400 }).addTo(TK.map); vhAim(TK.dm, vhBrg(p, tkTarget())); }
  const e = $("#tketa"); if (e) e.textContent = tkEta();
  const dg = TK.b.details?.dropoff_geo;
  if (!TK.rang && tkStage(TK.b) === 3 && dg && rmDist(p, dg) <= 100) {   // the rider is at your address: loud 4-second alert (js/notify.js)
    TK.rang = true;
    if (typeof ntPush === "function") ntPush("food", "Your rider has arrived", "Your order is at your location. Meet your rider.", true);
    if (typeof ntAlarm === "function") ntAlarm(4000);
  }
  if (first || Date.now() - TK.rt > 20000) { TK.rt = Date.now(); tkRoute(); }
  if (first) tkFit();
}

async function tkRoute() {   // road route from the rider to the current stop
  const seq = ++TK.rs, a = TK.pos, s = tkStage(TK.b);
  if (!a || s < 1 || s > 3) return;
  const b = tkTarget();
  try {
    const rt = (await (await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`)).json()).routes?.[0];
    if (!rt || seq !== TK.rs || !TK.map) return;
    if (TK.line) TK.line.remove();
    TK.line = L.polyline(rt.geometry.coordinates.map(([x, y]) => [y, x]), { color: "#f5b800", weight: 6, opacity: 1, className: "rt-line" }).addTo(TK.map);
  } catch (e) { /* the marker still moves without a route line */ }
}

function tkFit() {
  if (!TK.map) return;
  const pts = [TK.rm, TK.cm, TK.dm].filter(Boolean).map(m => m.getLatLng());
  TK.map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 60], paddingBottomRight: [40, $("#tsheet").offsetHeight + 30], maxZoom: 17 });
}

function closeTrack() {
  $("#track").classList.remove("on");
  if (TK.watch != null) navigator.geolocation.clearWatch(TK.watch);
  clearInterval(TK.timer);
  [TK.ch, TK.bc].forEach(c => c && sb.removeChannel(c));
  if (TK.map) TK.map.remove();
  for (const k in TK) delete TK[k];
  $("#tsheet").innerHTML = "";
}

$("#tkx").onclick = () => { closeTrack(); loadActs(); };
$("#tsheet").onclick = e => {
  if (e.target.closest("[data-rate]")) { const id = TK.id; closeTrack(); openReview(id); }
  else if (e.target.closest("[data-tkx]")) { closeTrack(); loadActs(); }
};
