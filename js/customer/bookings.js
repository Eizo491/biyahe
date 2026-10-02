// Creating, listing, cancelling and live-updating bookings.
const ACTS = new Map();   // booking id -> booking (used to re-open a ride in progress on the map)
async function book(type, pickup, dropoff, details, amount) {
  const { data, error } = await sb.from("bookings").insert({ type, pickup, dropoff, details, amount }).select().single();
  if (error) { toast("Could not book: " + error.message); return false; }
  toast(({ ride: "Ride", food: "Order", delivery: "Delivery" })[type] + " booked");
  loadActs();
  return data || true;
}

// Rides and food orders open on a map (Track ride / Track order) where Call, Message, plate number and Cancel live.
const hasMap = a => (a.type === "ride" && a.details?.pickup_geo && a.details?.dropoff_geo) || (a.type === "food" && a.details?.restaurant?.geo);

async function loadActs() {
  const [{ data, error }, rv] = await Promise.all([sb.from("bookings").select("*").order("created_at", { ascending: false }), sb.from("rider_reviews").select("booking_id, rating"), loadRiders(), loadShares()]);
  const rated = new Map((rv.data || []).map(x => [String(x.booking_id), x.rating]));
  if (error) { $("#acts").innerHTML = `<div class="empty">${esc(error.message)}</div>`; return; }
  ACTS.clear(); data.forEach(a => ACTS.set(String(a.id), a));
  shCleanup(data);   // trips that ended stop being shared
  $("#acts").innerHTML = data.length ? data.map(a => `<div class="act"><div class="row"><b>${a.type === "delivery" ? "Delivery" : a.type === "food" ? "Food" : "Ride"}</b><span class="tag">${STATUS[a.status]}</span></div>
  <div>${esc(a.details?.summary || a.dropoff)}</div>
  ${SH_LIVE.includes(a.status) ? shareBar(a.id) : ""}
  <div class="row" style="color:var(--mute);font-size:13px"><span>${new Date(a.created_at).toLocaleString()}${a.type === "ride" && PAYN[a.details?.pay] ? ` · ${PAYN[a.details.pay]}` : ""}</span><span class="price" style="color:var(--ink)">${peso(a.amount)}</span></div>
  <div class="abtns">${a.type === "food" && a.details?.restaurant?.geo && ["searching", "accepted", "on_the_way"].includes(a.status) ? `<button type="button" class="abtn pri" data-track="${a.id}">${ico("nav")}Track order</button>` : ""}${a.type === "ride" && a.details?.pickup_geo && a.details?.dropoff_geo && ["searching", "accepted", "on_the_way"].includes(a.status) ? `<button type="button" class="abtn pri" data-rtrack="${a.id}">${ico("nav")}Track ride</button>` : ""}${a.status === "searching" && !hasMap(a) ? `<button type="button" class="abtn no" data-cancel="${a.id}">Cancel</button>` : ""}
  ${a.status === "done" && a.rider_id ? (rated.has(String(a.id)) ? `<div class="mute">You rated your rider <span class="stars">${"★".repeat(rated.get(String(a.id)))}</span></div>` : `<button type="button" class="abtn pri" data-rate="${a.id}">Rate your rider</button>`) : ""}</div></div>`).join("")
  : `<div class="empty">No trips or orders yet. Book a ride, order food or send a package.</div>`;
}

$("#acts").onclick = async e => {
  const t = e.target.closest("[data-track]"), r = e.target.closest("[data-rate]"), c = e.target.closest("[data-cancel]");
  const rt = e.target.closest("[data-rtrack]");
  if (rt) {   // show this ride on the Ride tab's live map
    document.querySelector('#cnav [data-t="ride"]').click();   // open the Ride tab FIRST: a hidden map has no size, so it can't be fitted
    rmShow(ACTS.get(rt.dataset.rtrack));
    return;
  }
  if (t) { openTrack(t.dataset.track); return; }
  if (r) { openReview(r.dataset.rate); return; }
  if (c) { c.disabled = true; await sb.from("bookings").update({ status: "cancelled" }).eq("id", c.dataset.cancel); loadActs(); }
};

function listen() {
  if (st.chan) return;
  st.chan = sb.channel("b").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, loadActs).subscribe();
}
