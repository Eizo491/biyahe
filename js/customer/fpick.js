// Food: pick the delivery address on a searchable map (Leaflet + OpenStreetMap), no GPS needed.
// Search for a place or tap the map to drop a pin (drag to fine-tune), then Confirm.
const FP = { map: null, mk: null, ll: null, text: "", sugT: 0, seq: 0, sug: [] };

function fpOpen() {
  $("#fpick").classList.add("on");
  const c = st.fgeo || RM.a || { lat: RM_CENTER[0], lng: RM_CENTER[1] };
  if (!FP.map) {
    FP.map = L.map("fpmap", { zoomControl: false }).setView([c.lat, c.lng], 15);
    biyaheTiles().addTo(FP.map);
    L.control.zoom({ position: "topright" }).addTo(FP.map);
    FP.map.on("click", e => { fpSug([]); document.activeElement.blur(); fpSet(e.latlng); });
    new ResizeObserver(() => { FP.map.invalidateSize(); $("#fpick").style.setProperty("--sh", $("#fpsheet").offsetHeight + "px"); }).observe($("#fpick"));
  }
  setTimeout(() => FP.map.invalidateSize(), 50);
  if (st.fgeo) fpSet(st.fgeo, { text: $("#fa").value.trim(), pan: true });   // reopen on the pin already chosen
  else { fpReset(); FP.map.setView([c.lat, c.lng], 15); }
}

function fpClose() { $("#fpick").classList.remove("on"); fpSug([]); }

function fpReset() {
  if (FP.mk) { FP.mk.remove(); FP.mk = null; }
  FP.ll = null; FP.text = ""; FP.seq++;
  $("#fpq").value = "";
  fpShow();
}

function fpShow() {
  const a = $("#fpaddr"), ok = $("#fpok");
  a.hidden = !FP.ll; a.textContent = FP.text;
  $("#fphint").hidden = !!FP.ll;
  ok.disabled = !(FP.ll && FP.text && FP.text !== "Finding address…");
}

function fpSet(ll, o = {}) {
  const p = { lat: ll.lat, lng: ll.lng }, seq = ++FP.seq;
  FP.ll = p;
  if (FP.mk) FP.mk.setLatLng([p.lat, p.lng]);
  else {
    FP.mk = L.marker([p.lat, p.lng], { icon: rmPin("b"), draggable: true, keyboard: false }).addTo(FP.map);
    FP.mk.on("dragend", e => fpSet(e.target.getLatLng()));
  }
  if (o.pan) FP.map.setView([p.lat, p.lng], Math.max(FP.map.getZoom(), 17));
  if (o.text) { FP.text = o.text; $("#fpq").value = o.text; }
  else {
    FP.text = "Finding address…";
    rmReverse(p).then(t => { if (seq === FP.seq) { FP.text = t; $("#fpq").value = t; fpShow(); } });
  }
  fpShow();
}

// ---------- Search suggestions (OpenStreetMap Nominatim) ----------
function fpSug(list) {
  FP.sug = list;
  const box = $("#fpsug");
  box.hidden = !list.length;
  box.innerHTML = list.map((s, i) => `<button type="button" data-i="${i}">${esc(s.text)}</button>`).join("");
}
async function fpSearch(q) {
  const c = FP.map.getCenter(), vb = [c.lng - .6, c.lat + .6, c.lng + .6, c.lat - .6].join(",");
  try {
    const j = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=ph&accept-language=en&viewbox=${vb}&q=${encodeURIComponent(q)}`)).json();
    if ($("#fpq").value.trim() !== q) return;   // they kept typing
    fpSug(j.map(x => ({ ll: { lat: +x.lat, lng: +x.lon }, text: x.display_name.split(",").slice(0, 3).join(",").trim() })));
    if (!j.length) toast("No results. Try another spelling or tap the map.");
  } catch (e) { fpSug([]); }
}
$("#fpq").addEventListener("input", () => {
  clearTimeout(FP.sugT);
  const q = $("#fpq").value.trim();
  if (q.length < 3) { fpSug([]); return; }
  FP.sugT = setTimeout(() => fpSearch(q), 450);
});
$("#fpq").addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  if (FP.sug[0]) fpPick(FP.sug[0]); else { clearTimeout(FP.sugT); const q = $("#fpq").value.trim(); if (q.length >= 3) fpSearch(q); }
});
function fpPick(s) { fpSug([]); fpSet(s.ll, { text: s.text, pan: true }); document.activeElement.blur(); }
$("#fpsug").onclick = e => { const b = e.target.closest("button"); if (b) fpPick(FP.sug[+b.dataset.i]); };

$("#fpback").onclick = fpClose;
$("#fpok").onclick = () => {
  if (!FP.ll) return;
  st.fgeo = FP.ll;                 // exact drop-off point, used for the rider's route
  $("#fa").value = FP.text;
  fpClose(); renderCko();
};
