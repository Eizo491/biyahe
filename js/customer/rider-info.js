// Rider identity for the customer: name, vehicle and PLATE NUMBER of the rider who took their booking.
// Riders must give a plate number to apply, so the customer can check it matches the vehicle that arrives.
// Data comes from get_my_booking_riders() (supabase/rider-plate.sql), which only returns riders of the caller's own bookings.
const RIDERS = new Map();   // booking id -> { rider_name, vehicle, plate, avg_rating, review_count }

async function loadRiders() {
  const { data, error } = await sb.rpc("get_my_booking_riders");
  if (error) return;   // the app still works without it (e.g. the SQL file hasn't been run yet)
  RIDERS.clear();
  (data || []).forEach(r => RIDERS.set(String(r.booking_id), r));
}

// Small card: rider name, vehicle + rating, and the plate shown like a real plate.
function riderCard(id, done) {
  const r = RIDERS.get(String(id));
  if (!r) return "";
  const rate = r.review_count ? ` · ★ ${r.avg_rating}` : "";
  return `<div class="rp"><span class="rk-av vh-th">${vhSvg(r.vehicle || "Motorcycle")}</span>
    <div class="rp-who"><b>${esc(r.rider_name)}</b><small>${esc(r.vehicle || "Rider")}${rate}</small></div>
    <div class="rp-plate" aria-label="Plate number ${esc(r.plate)}"><small>PLATE NO.</small><b>${esc(r.plate)}</b></div></div>
    ${done ? "" : `<small class="rp-note">Check that the plate number matches before you ride or hand over anything.</small>`}`;
}
