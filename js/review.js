// "Rate your rider" sheet for customers, shown on finished bookings. Saved through rate_rider() in supabase/rider-stats.sql.
let rvBooking = null, rvStars = 0;
const rvEl = () => $("#rvsheet");

const RV_LBL = ["Tap a star", "😞 Poor", "😕 Fair", "🙂 Good", "😀 Very good", "🤩 Excellent!"];
function renderRvStars() {
  $("#rvstars").innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" class="${n <= rvStars ? "on" : ""}" style="--i:${n - 1}" data-n="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("");
  const l = $("#rvlbl"); l.textContent = RV_LBL[rvStars]; l.style.animation = "none"; void l.offsetWidth; l.style.animation = "";
}
function openReview(id) {
  rvBooking = id; rvStars = 0; $("#rvbox").classList.remove("sent"); renderRvStars();
  $("#rvmsg").value = ""; $("#rverr").textContent = "";
  rvEl().classList.remove("leave"); rvEl().classList.add("open");
}
function closeReview() {
  const f = rvEl();
  if (!f.classList.contains("open")) return;
  f.classList.add("leave");
  setTimeout(() => f.classList.remove("open", "leave"), 250);
}

$("#rvcancel").onclick = closeReview;
rvEl().onclick = e => { if (e.target.id === "rvsheet") closeReview(); };
document.addEventListener("keydown", e => { if (e.key === "Escape") closeReview(); });
$("#rvstars").onclick = e => {
  const b = e.target.closest("button");
  if (b) { rvStars = +b.dataset.n; renderRvStars(); $("#rverr").textContent = ""; }
};

$("#rvsubmit").onclick = async () => {
  if (!rvStars) { $("#rverr").textContent = "Tap a star rating first."; return; }
  const btn = $("#rvsubmit");
  UI.busy(btn, true);
  const { error } = await sb.rpc("rate_rider", { p_booking: String(rvBooking), p_rating: rvStars, p_comment: $("#rvmsg").value.trim() || null });
  UI.busy(btn, false);
  if (error) { $("#rverr").textContent = error.message; return; }
  $("#rvbox").classList.add("sent");   // animated thank-you, then the sheet closes
  loadActs();
  setTimeout(closeReview, 1400);
};
