// Food tab: categories -> store list -> a store page (its own menu, cart, address and Place order) -> live tracking (track.js).
const CATS = ["All", "Fast food", "Restaurants", "Cafés & drinks", "Groceries", "Pharmacy"];
const catOf = r => r.category || (/burger|chicken|fries|fast|pizza|sandwich|hotdog/i.test(r.cuisine || "") ? "Fast food" : /coffee|tea|milk|caf[eé]|dessert|bakery|drink/i.test(r.cuisine || "") ? "Cafés & drinks" : /grocer|mart|market|essential/i.test(r.cuisine || "") ? "Groceries" : /pharm|botica|drug|health/i.test(r.cuisine || "") ? "Pharmacy" : "Restaurants");
const storeOf = id => st.rests.find(r => r.id === id);

async function loadRests() {
  const { data, error } = await sb.from("restaurants").select("*, menu_items(*)");
  if (error) { $("#rests").innerHTML = `<div class="empty">${esc(error.message)}</div>`; return; }
  st.rests = data;
  renderFood();
  if (st.open) renderStore();
}

function cartItems(rid) {   // items in the cart for one store
  const out = [], r = storeOf(rid);
  if (r) r.menu_items.forEach(m => { const q = st.cart[m.id]; if (q) out.push({ id: m.id, name: m.name, price: +m.price, q }); });
  return out;
}

const FEE = 30;   // delivery fee per store
const cartStores = () => st.rests.map(r => { const items = cartItems(r.id); return { r, items, n: items.reduce((a, i) => a + i.q, 0), sub: items.reduce((a, i) => a + i.price * i.q, 0) }; }).filter(x => x.n);
function cartAdd(k, d) { st.cart[k] = Math.max(0, (st.cart[k] || 0) + d); }
function cartRefresh() { renderFood(); if (st.open) renderStore(); }
function updateCartBar() {   // floating "View cart" button on the store list
  const cs = cartStores(), n = cs.reduce((a, x) => a + x.n, 0), b = $("#fcart");
  b.hidden = !n;
  b.innerHTML = `<span>View cart · ${n} item${n > 1 ? "s" : ""}${cs.length > 1 ? ` · ${cs.length} stores` : ""}</span><b>${peso(cs.reduce((a, x) => a + x.sub, 0))}</b>`;
}
$("#fcart").onclick = openCko;

// ---------- Store list ----------
function renderFood() {
  const cat = st.cat || "All", list = st.rests.filter(r => cat === "All" || catOf(r) === cat);
  $("#fcats").innerHTML = CATS.map(c => `<button type="button" class="${c === cat ? "on" : ""}" data-c="${c}">${c}</button>`).join("");
  $("#rests").innerHTML = list.length ? list.map(r => {
    const n = cartItems(r.id).reduce((a, i) => a + i.q, 0);
    return `<div class="rest"><button data-open="${r.id}">${n ? `<span class="tag rest-n">${n} in cart</span>` : ""}<b><i class="ric">${ico(r.icon || STORE_ICON[catOf(r)])}</i>${esc(r.name)}</b><small>${esc(r.cuisine)} · ${esc(catOf(r))} · ${r.eta_minutes} min</small></button></div>`;
  }).join("") : `<div class="empty">No stores in this category yet.</div>`;
  updateCartBar();
}
$("#fcats").onclick = e => { const b = e.target.closest("[data-c]"); if (b) { st.cat = b.dataset.c; renderFood(); } };
$("#rests").onclick = e => { const o = e.target.closest("[data-open]"); if (o) openStore(o.dataset.open); };

// ---------- Store page ----------
const menuItem = (m, cat) => `<div class="item"><span><i class="mic">${ico(itemIcon(m, cat))}</i><span class="mtx">${esc(m.name)}<small>${m.description ? esc(m.description) + " · " : ""}${peso(m.price)}</small></span></span><span class="qty"><button data-k="${m.id}" data-d="-1" aria-label="Remove one">−</button>${st.cart[m.id] || 0}<button data-k="${m.id}" data-d="1" aria-label="Add one">+</button></span></div>`;

function openStore(id) { st.open = id; $("#store").classList.add("on"); $("#stmenu").scrollTop = 0; renderStore(); }
function closeStore() { st.open = null; $("#store").classList.remove("on"); renderFood(); }

function renderStore() {
  const r = storeOf(st.open);
  if (!r) { closeStore(); return; }
  const cat = catOf(r), secs = [...new Set(r.menu_items.map(m => m.section || "Menu"))];
  $("#stname").innerHTML = `<i class="ric">${ico(r.icon || STORE_ICON[cat])}</i>${esc(r.name)}`;
  $("#stsub").textContent = `${r.cuisine} · ${cat} · ${r.eta_minutes} min`;
  $("#stmenu").innerHTML = r.menu_items.length
    ? `<div class="smenu">${secs.map(sec => `<p class="msec">${esc(sec)}</p>` + r.menu_items.filter(m => (m.section || "Menu") === sec).map(m => menuItem(m, cat)).join("")).join("")}</div>`
    : `<div class="empty">No menu yet.</div>`;
  const cs = cartStores(), cn = cs.reduce((a, x) => a + x.n, 0), ct = cs.reduce((a, x) => a + x.sub, 0);
  $("#fbook").textContent = cn ? `Review order · ${cn} item${cn > 1 ? "s" : ""} · ${peso(ct)}` : "Add items to order";
  $("#fbook").disabled = !cn;
}

$("#stback").onclick = closeStore;
$("#stmenu").onclick = e => {
  const b = e.target.closest("[data-k]");
  if (!b) return;
  cartAdd(b.dataset.k, +b.dataset.d);   // the cart can hold several restaurants
  renderStore();
};
$("#fa").oninput = () => { st.fgeo = null; renderCko(); };
$("#fgps").onclick = () => fpOpen();   // pick the delivery spot on a searchable map (js/customer/fpick.js)

async function geocode(q) {   // typed address -> coordinates (OpenStreetMap Nominatim)
  try {
    const j = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&q=${encodeURIComponent(q)}`)).json();
    return j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null;
  } catch (e) { return null; }
}

$("#fbook").onclick = () => openCko();

// ---------- Review screen: double-check, edit, add more stores, then confirm ----------
function openCko() { $("#cko").classList.add("on"); renderCko(); }
function closeCko() { $("#cko").classList.remove("on"); }
function renderCko() {
  const cs = cartStores(), ok = $("#fa").value.trim(), t = cs.reduce((s, x) => s + x.sub + FEE, 0);
  $("#ckolist").innerHTML = cs.length ? cs.map(({ r, items, sub }) => `<div class="ck-st"><div class="ck-h"><b><i class="ric">${ico(r.icon || STORE_ICON[catOf(r)])}</i>${esc(r.name)}</b><button type="button" class="link" data-clear="${r.id}">Remove all</button></div>
    ${items.map(i => `<div class="ck-i"><span class="ck-n">${esc(i.name)}<small>${peso(i.price)} each</small></span><span class="qty"><button data-k="${i.id}" data-d="-1" aria-label="Remove one">−</button>${i.q}<button data-k="${i.id}" data-d="1" aria-label="Add one">+</button></span><b class="ck-p">${peso(i.price * i.q)}</b></div>`).join("")}
    <div class="ck-sub"><span>Subtotal</span><span>${peso(sub)}</span></div><div class="ck-sub"><span>Delivery</span><span>${peso(FEE)}</span></div></div>`).join("")
    : `<div class="empty">Your cart is empty.</div>`;
  $("#ckotot").innerHTML = cs.length ? `<span>Total${cs.length > 1 ? ` · ${cs.length} separate orders` : ""}</span><b>${peso(t)}</b>` : "";
  $("#ckoplace").textContent = cs.length > 1 ? `Confirm & place ${cs.length} orders` : "Confirm & place order";
  $("#ckoplace").disabled = !(cs.length && ok);
  $("#ckowarn").hidden = !cs.length || !!ok;
}
$("#ckoback").onclick = closeCko;
$("#ckoadd").onclick = () => { closeCko(); closeStore(); };   // back to the store list to pick another restaurant
$("#ckolist").onclick = e => {
  const b = e.target.closest("[data-k]"), c = e.target.closest("[data-clear]");
  if (b) cartAdd(b.dataset.k, +b.dataset.d);
  else if (c) { const r = storeOf(c.dataset.clear); r && r.menu_items.forEach(m => delete st.cart[m.id]); }
  else return;
  renderCko(); cartRefresh();
};

$("#ckoplace").onclick = async () => {
  const cs = cartStores(), addr = $("#fa").value.trim();
  if (!cs.length || !addr) return;
  const btn = $("#ckoplace"); btn.disabled = true; btn.textContent = "Placing…";
  const drop = st.fgeo || await geocode(addr) || (RM.a && { lat: RM.a.lat, lng: RM.a.lng }) || { lat: RM_CENTER[0], lng: RM_CENTER[1] };
  let first = null, placed = 0;
  for (const { r, items, n, sub } of cs) {   // one order (and one rider) per restaurant
    // Store position: from the restaurants table, else a demo spot ~900 m from the customer.
    const geo = r.lat && r.lng ? { lat: +r.lat, lng: +r.lng } : rmOff(drop, 900, [...String(r.id)].reduce((s, c) => s + c.charCodeAt(0), 0) % 628 / 100);
    const row = await book("food", r.name, addr, { items: items.map(({ name, price, q }) => ({ name, price, q })), summary: `${n} item${n > 1 ? "s" : ""} from ${r.name}`, restaurant: { id: r.id, name: r.name, geo }, dropoff_geo: drop, stage: "placed" }, sub + FEE);
    if (!row) break;
    placed++; first = first || row; items.forEach(i => delete st.cart[i.id]);
  }
  if (placed) { if (placed > 1) toast(`${placed} orders placed`); closeStore(); openTrack(first.id); }
  if (placed === cs.length) closeCko(); else renderCko();
  cartRefresh();
};
