// Safety check-in: when Route Watch flags the trip, ask "Are you okay?". No answer / "I need help" => server escalates
// (owner alert -> high, SOS on for any shared trip link). Server side: supabase/checkin.sql.
const CI = { timer: null, tick: null, id: null };
function ciStop() { clearInterval(CI.timer); clearInterval(CI.tick); CI.timer = CI.tick = CI.id = null; const m = $("#cimodal"); if (m) m.remove(); }
function ciStart() {
  ciStop();
  const poll = async () => {
    if (CI.id) return;
    const { data } = await sb.rpc("my_pending_checkin");
    const c = Array.isArray(data) ? data[0] : data;
    if (c && c.id) ciShow(c);
  };
  CI.timer = setInterval(poll, 8000); poll();
}
function ciShow(c) {
  CI.id = c.id;
  const m = document.createElement("div"); m.id = "cimodal"; m.setAttribute("role", "alertdialog");
  m.innerHTML = `<div class="cibox"><h2>Are you okay?</h2><p>Your ride looks unusual (${esc(String(c.kind || "route").replace("_", " "))}). Tap to let us know.</p><div class="cit" id="citime"></div><button class="abtn pri" id="ciok">I'm okay</button><button class="abtn sos" id="cihelp">I need help</button></div>`;
  document.body.appendChild(m);
  const end = new Date(c.due_at).getTime(), left = () => Math.max(0, Math.ceil((end - Date.now()) / 1000));
  const done = async help => {
    clearInterval(CI.tick);
    const { data, error } = await sb.rpc("answer_checkin", { p_id: c.id, p_help: help });
    if (error) { toast(error.message); m.remove(); CI.id = null; return; }
    if (help) m.querySelector(".cibox").innerHTML = `<h2>Help is being alerted</h2><p>${data && data.shared ? "Your trip contact now sees a red SOS alert and the Biyahe owner was notified." : "The Biyahe owner was notified. No one has your trip link yet. Share it from your booking."}</p><a class="abtn sos" href="tel:911">Call 911</a><button class="abtn" id="ciclose">Close</button>`;
    else m.remove();
    const x = $("#ciclose"); if (x) x.onclick = () => m.remove();
    CI.id = null;
  };
  $("#ciok").onclick = () => done(false); $("#cihelp").onclick = () => done(true);
  const tick = () => { $("#citime").textContent = left() ? `Alerting in ${left()}s if no answer` : "Alerting now…"; if (!left()) done(true); };
  tick(); CI.tick = setInterval(tick, 1000);
}
