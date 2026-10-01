// Feedback sheet, shared by customers and riders. Rows are written to public.feedback (see supabase/admin-dashboard.sql).
let fbStars = 0;
const fbEl = () => $("#fbsheet");

function renderStars() {
  $("#fbstars").innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" class="${n <= fbStars ? "on" : ""}" style="--i:${n - 1}" data-n="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("");
}
function openFeedback() {
  fbStars = 0; renderStars();
  $("#fbmsg").value = ""; $("#fberr").textContent = "";
  fbEl().classList.remove("leave"); fbEl().classList.add("open");
  setTimeout(() => $("#fbmsg").focus(), 50);
}
function closeFeedback() {
  const f = fbEl();
  if (!f.classList.contains("open")) return;
  f.classList.add("leave");
  setTimeout(() => f.classList.remove("open", "leave"), 250);
}

document.querySelectorAll(".fbopen").forEach(b => b.onclick = openFeedback);
$("#fbcancel").onclick = closeFeedback;
fbEl().onclick = e => { if (e.target.id === "fbsheet") closeFeedback(); };
document.addEventListener("keydown", e => { if (e.key === "Escape") closeFeedback(); });
$("#fbstars").onclick = e => {
  const b = e.target.closest("button");
  if (b) { fbStars = fbStars === +b.dataset.n ? 0 : +b.dataset.n; renderStars(); }
};
$("#fbmsg").oninput = () => { $("#fberr").textContent = ""; };

$("#fbsubmit").onclick = async () => {
  const msg = $("#fbmsg").value.trim();
  if (msg.length < 3) { $("#fberr").textContent = "Please write a short message."; return; }
  const btn = $("#fbsubmit");
  UI.busy(btn, true);
  const { error } = await sb.from("feedback").insert({ rating: fbStars || null, message: msg });
  UI.busy(btn, false);
  if (error) { $("#fberr").textContent = error.message; return; }
  closeFeedback();
  toast("Thanks! Your feedback was sent.");
};
