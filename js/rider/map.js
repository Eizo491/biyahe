// Rider live job map (food jobs): your GPS, the store, the customer (their live GPS when shared), route + next-step button.
const JM = {};
const jmStage = b => b.status === "on_the_way" ? 3 : b.details?.stage === "at_rest" ? 2 : 1;
const jmTarget = () => jmStage(JM.b) < 3 ? JM.b.details.restaurant.geo : (JM.cust || JM.b.details.dropoff_geo);

function jmOpen(id) {
  const j = jobData.get(String(id)), rg = j?.details?.restaurant?.geo, cg = j?.details?.dropoff_geo;
  if (!rg || !cg) { toast("No map for this job"); return; }
  jmClose();
  Object.assign(JM, { b: j, id: String(id), me: TRK.last || null, cust: TRK.cust?.[String(id)] || null, rs: 0, rt: 0, stage: -1 });
  $("#jobmap").classList.add("on");
  JM.map = L.map("jmap", { zoomControl: false }).setView([cg.lat, cg.lng], 15);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(JM.map);
  JM.rm = L.marker([rg.lat, rg.lng], { icon: tkIcon("", "Pick up") }).addTo(JM.map);
  JM.cm = L.marker([cg.lat, cg.lng], { icon: tkIcon("b", "Drop off") }).addTo(JM.map);
  JM.bc = sb.channel("jmb-" + JM.id).on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: "id=eq." + JM.id }, p => {
    JM.b = p.new;
    if (p.new.status === "done" || p.new.status === "cancelled") { toast(p.new.status === "done" ? "Delivery complete. Nice work!" : "This order was cancelled"); jmClose(); return; }
    jmRender();
  }).subscribe();
  if (JM.me) jmMe();
  if (JM.cust) jmCust(JM.id, JM.cust);
  jmRender();
  setTimeout(() => { if (JM.map) { JM.map.invalidateSize(); jmFit(); } }, 60);
}

function jmEta() {
  if (!JM.me) return "Getting your GPS position…";
  const s = jmStage(JM.b), m = rmDist(JM.me, jmTarget());
  return s === 2 ? "You're at the pickup" : `${Math.max(1, Math.ceil(m / RM_MPM))} min · ${(m / 1000).toFixed(1)} km to ${s < 3 ? "pick up" : "drop off"}`;
}
function jmMe() {   // your own GPS moved (called from rider/track.js)
  if (!JM.map || !TRK.last) return;
  const first = !JM.me, ll = [TRK.last.lat, TRK.last.lng]; JM.me = TRK.last;
  if (JM.mm) vhPlace(JM.mm, ll);
  else { JM.mm = L.marker(ll, { icon: vhIcon(window.myVeh || "Motorcycle", { glide: true, box: true, hot: true }), zIndexOffset: 400 }).addTo(JM.map); vhAim(JM.mm, vhBrg(TRK.last, jmTarget())); }
  const e = $("#jmeta"); if (e) e.textContent = jmEta();
  if (first || Date.now() - JM.rt > 20000) { JM.rt = Date.now(); jmRoute(); }
  if (first) jmFit();
}
function jmCust(id, p) {   // the customer's live GPS arrived
  if (!JM.map || id !== JM.id) return;
  JM.cust = p; const ll = [p.lat, p.lng];
  if (JM.cl) JM.cl.setLatLng(ll);
  else { JM.cl = L.marker(ll, { icon: L.divIcon({ className: "rm-glide", html: `<div class="rm-me"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 300 }).addTo(JM.map); JM.cl.bindTooltip("Customer (live)", { permanent: true, direction: "top", offset: [0, -12] }); if (jmStage(JM.b) === 3) jmRender(); }
  const e = $("#jmeta"); if (e) e.textContent = jmEta();
}

function jmRender() {
  const b = JM.b, d = b.details, s = jmStage(b), rn = esc(d.restaurant.name), nx = nextFor(b), t = jmTarget();
  const items = (d.items || []).map(i => `${i.q}× ${esc(i.name)}`).join(", ");
  $("#jsheet").innerHTML = `<div class="rt"><span class="jc-ic">${ico("nav")}</span><div><b>${["", `Head to ${rn}`, `Collect the order at ${rn}`, "Deliver to the customer"][s]}</b><small id="jmeta">${jmEta()}</small></div><div class="jc-fare"><b>${peso(b.amount)}</b></div></div>
    <div class="jc-route"><div><i></i><span><small>Pick up</small>${rn}</span></div><div><i class="rt-b"></i><span><small>Drop off</small>${esc(b.dropoff)}</span></div></div>
    ${items ? `<p class="jc-items">${items}</p>` : ""}
    <p class="rt-note">${s === 3 ? (JM.cust ? "Showing the customer's live location." : "Customer isn't sharing live location yet. Using their address.") : "Your live location is shared with the customer."}</p>
    <div class="jc-btns"><a class="cta alt" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}&travelmode=two-wheeler">${ico("nav")}Navigate</a>${nx ? `<button class="cta" data-adv>${nx[1]}</button>` : ""}</div>`;
  if (s !== JM.stage) { JM.stage = s; if (JM.line) { JM.line.remove(); JM.line = null; } jmRoute(); jmFit(); }
}

async function jmRoute() {
  const seq = ++JM.rs, a = JM.me;
  if (!a || !JM.map) return;
  const b = jmTarget();
  try {
    const rt = (await (await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`)).json()).routes?.[0];
    if (!rt || seq !== JM.rs || !JM.map) return;
    if (JM.line) JM.line.remove();
    JM.line = L.polyline(rt.geometry.coordinates.map(([x, y]) => [y, x]), { color: accent(), weight: 5, opacity: .85 }).addTo(JM.map);
  } catch (e) { /* keep going without a route line */ }
}
function jmFit() {
  if (!JM.map) return;
  const pts = [JM.rm, JM.cm, JM.mm, JM.cl].filter(Boolean).map(m => m.getLatLng());
  JM.map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 60], paddingBottomRight: [40, $("#jsheet").offsetHeight + 30], maxZoom: 17 });
}
function jmClose() {
  $("#jobmap").classList.remove("on");
  if (JM.bc) sb.removeChannel(JM.bc);
  if (JM.map) JM.map.remove();
  for (const k in JM) delete JM[k];
  $("#jsheet").innerHTML = "";
}
$("#jmx").onclick = jmClose;
$("#jsheet").onclick = e => { if (e.target.closest("[data-adv]") && JM.b) { const nx = nextFor(JM.b); if (nx) jobAdvance(JM.b, nx[0], nx[2]); } };

document.addEventListener("themechange", () => { if (typeof JM !== "undefined" && JM.line) JM.line.setStyle({ color: accent() }); });
