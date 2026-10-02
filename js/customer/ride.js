// Ride tab: vehicle options, fare from the real route distance, booking.
// The map, Start/Finish pins and nearby riders live in map.js.
function renderPay() {   // "Pay with" chips: Cash / GCash / Maya / Card
  $("#rpay").innerHTML = `<span class="rpay-l">Pay with</span>` + PAY.map(p => `<button type="button" class="pc ${st.pay === p.k ? "sel" : ""}" data-p="${p.k}" role="radio" aria-checked="${st.pay === p.k}">${p.n}</button>`).join("");
}
$("#rpay").onclick = e => { const b = e.target.closest(".pc"); if (b) { st.pay = b.dataset.p; renderPay(); } };

function renderVeh() {
  renderPay();
  const km = RM.km, ready = !!(RM.a && RM.b), v = st.veh !== null ? VEH[st.veh] : null;
  $("#vehicles").innerHTML = VEH.map((x, i) => `<button type="button" class="vo ${st.veh === i ? "sel" : ""}" data-i="${i}"><span class="vo-i">${vhSvg(x.n)}</span><b>${x.n}</b><span class="price">${km != null ? peso(x.base + x.km * km) : "from " + peso(x.base)}</span><small>${x.d}</small></button>`).join("");
  $("#rmeta").textContent = km != null ? `${km.toFixed(1)} km · about ${RM.min} min` : RM.a ? "Now set your Finish on the map" : "Set your Start and Finish on the map";
  const b = $("#rbook");
  b.disabled = !(ready && v);
  b.textContent = ready && v ? `Book ${v.n} · ${peso(v.base + v.km * km)}` : "Book ride";
}

$("#vehicles").onclick = e => {
  const b = e.target.closest(".vo");
  if (b) { st.veh = +b.dataset.i; renderVeh(); }
};

$("#rbook").onclick = async () => {
  if (!(RM.a && RM.b) || st.veh === null) return;
  const v = VEH[st.veh], km = RM.km || 0, btn = $("#rbook");
  btn.disabled = true;
  const ok = await book("ride", RM.txt.a, RM.txt.b, {
    vehicle: v.n, pay: st.pay, summary: `${v.n} to ${RM.txt.b}`, km: +km.toFixed(1), pickup_geo: RM.a, dropoff_geo: RM.b
  }, Math.round(v.base + v.km * km));
  if (ok) { RM.bid = ok.id; RM.pay = st.pay; RM.fare = Math.round(v.base + v.km * km); rmBooked(v.n); }   // map: nearby riders + your GPS appear, a rider is matched and drives to you
  else renderVeh();
};
