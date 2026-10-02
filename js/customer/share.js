// "Share my trip": the customer chooses to send a private link to someone they trust. That person sees the
// live location of the customer and the rider in share.html, without the app or an account.
// Nothing is shared until the customer taps the button. Server side: supabase/trip-share.sql.
const SH = new Map();                       // booking id -> secret token (active shares only)
const SOS = new Set();                      // booking ids whose SOS alert is on
const SHW = { watch: null, timer: null, pos: null };
const SH_LIVE = ["searching", "accepted", "on_the_way"];

const shUrl = t => new URL("share.html", location.href).href + "#" + t;   // token in the #, so it is never sent to a server or a referrer

function shInner(id) {
  id = String(id);
  return SH.has(id)
    ? `<div class="shb-on"><span class="shb-dot"></span><div><b>Sharing your trip live</b><small>Anyone with your link can see where you and your rider are until the trip ends. Keep Biyahe open so your location keeps updating (your screen stays on while you share).</small></div></div>
       <div class="abtns"><button type="button" class="abtn pri" data-sh="send" data-b="${id}">Send link</button><button type="button" class="abtn no" data-sh="stop" data-b="${id}">Stop sharing</button></div>
       ${SOS.has(id)
         ? `<div class="shb-sos on"><b>SOS is ON. Your contact sees a red alert.</b><div class="abtns"><a class="abtn sos" href="tel:911">Call 911</a><button type="button" class="abtn" data-sh="sosoff" data-b="${id}">I'm safe, cancel SOS</button></div></div>`
         : `<button type="button" class="abtn sos shb-sosbtn" data-sh="sos" data-b="${id}">SOS: alert my contact</button>`}`
    : `<button type="button" class="abtn shb-start" data-sh="start" data-b="${id}">Share my trip with someone I trust</button>
       <small class="shb-hint">They can follow you and your rider live, no app needed. You choose who gets the link.</small>`;
}
const shareBar = id => id ? `<div class="shb" data-shbar="${id}">${shInner(id)}</div>` : "";
function shRefresh() { document.querySelectorAll("[data-shbar]").forEach(e => { e.innerHTML = shInner(e.dataset.shbar); }); }

async function loadShares() {
  const { data, error } = await sb.rpc("my_trip_shares");
  if (error) return;   // the app still works if the SQL file hasn't been run yet
  SH.clear(); SOS.clear(); (data || []).forEach(r => { SH.set(String(r.booking_id), r.token); if (r.sos) SOS.add(String(r.booking_id)); });
  shSync(); shRefresh();
}

// Sharing ends by itself when the trip is finished or cancelled.
function shCleanup(bookings) {
  (bookings || []).forEach(b => { if (SH.has(String(b.id)) && !SH_LIVE.includes(b.status)) shStop(b.id, true); });
}

// ---------- Sending the customer's own location ----------
// Keep the screen on while sharing: a web page can't send its location once the phone locks.
let shWake = null;
async function shWakeOn() {
  try {
    if (!("wakeLock" in navigator) || shWake || document.visibilityState !== "visible") return;
    shWake = await navigator.wakeLock.request("screen");
    shWake.addEventListener("release", () => { shWake = null; });
  } catch (_) { shWake = null; }
}
function shWakeOff() { try { if (shWake) shWake.release(); } catch (_) {} shWake = null; }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && SH.size) { shWakeOn(); shLast = 0; shPush(); } });

function shSync() {
  if (SH.size) shWakeOn(); else shWakeOff();
  if (!SH.size) {
    if (SHW.watch != null) { navigator.geolocation.clearWatch(SHW.watch); SHW.watch = null; }
    if (SHW.timer) { clearInterval(SHW.timer); SHW.timer = null; }
    SHW.pos = null; return;
  }
  if (SHW.watch == null && navigator.geolocation)
    SHW.watch = navigator.geolocation.watchPosition(p => { SHW.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; shPush(); },
      () => toast("Turn on location so your contact can see where you are"), { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
  if (!SHW.timer) SHW.timer = setInterval(shPush, 5000);
}
let shLast = 0;
async function shPush() {
  if (!SHW.pos || Date.now() - shLast < 4000) return;
  shLast = Date.now();
  for (const [id, token] of [...SH]) {
    const { data, error } = await sb.rpc("share_update_location", { p_token: token, p_lat: SHW.pos.lat, p_lng: SHW.pos.lng });
    if (!error && data === false) { SH.delete(id); SOS.delete(id); shSync(); shRefresh(); }   // the share ended on the server
  }
}

// ---------- Buttons ----------
// "Send link" opens a picker so the customer chooses the app: Messages, Messenger, Viber, WhatsApp, Telegram, Email, or copy the link.
const SH_TEXT = "Follow my Biyahe trip live. You can see where I am and who my rider is:";
const SH_APPS = [
  { k: "sms", n: "Messages", c: "#34c759", i: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>', href: (u, t) => "sms:?&body=" + encodeURIComponent(t + " " + u) },
  { k: "msgr", n: "Messenger", c: "#0a84ff", i: '<path d="M12 3a9 9 0 0 0-9 8.8c0 2.4 1 4.6 2.7 6.1V21l2.8-1.6c.8.2 1.6.4 2.5.4a9 9 0 0 0 0-17.8zM8 14l3-3.2 2 2 3-2.8"/>', href: u => "fb-messenger://share/?link=" + encodeURIComponent(u), copy: true },
  { k: "viber", n: "Viber", c: "#7360f2", i: '<path d="M6 4h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-4 4v-4H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 8.500c0 3 2.500 5.500 5.500 5.500"/>', href: (u, t) => "viber://forward?text=" + encodeURIComponent(t + " " + u), copy: true },
  { k: "wa", n: "WhatsApp", c: "#25d366", i: '<path d="M4 20l1.300-4A8 8 0 1 1 8.200 18.800zM9 9c0 3 3 6 6 6"/>', href: (u, t) => "https://wa.me/?text=" + encodeURIComponent(t + " " + u) },
  { k: "tg", n: "Telegram", c: "#29a9eb", i: '<path d="M21 4L3 11l6 2 2 6 3-4 5 3z"/>', href: (u, t) => "https://t.me/share/url?url=" + encodeURIComponent(u) + "&text=" + encodeURIComponent(t) },
  { k: "mail", n: "Email", c: "#8e8e93", i: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', href: (u, t) => "mailto:?subject=" + encodeURIComponent("My Biyahe trip") + "&body=" + encodeURIComponent(t + "\n" + u) }
];
async function shCopy(url, quiet) {
  try { await navigator.clipboard.writeText(url); if (!quiet) toast("Link copied. Paste it to someone you trust."); return true; }
  catch (_) { window.prompt("Copy this link and send it to someone you trust:", url); return false; }
}
function shPickClose() { const m = document.getElementById("shpick"); if (m) m.classList.remove("on"); }
function shSend(id) {
  const token = SH.get(String(id)); if (!token) return;
  let m = document.getElementById("shpick");
  if (!m) {
    m = document.createElement("div"); m.id = "shpick"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", "Send trip link");
    document.body.appendChild(m);
    m.onclick = e => {
      if (e.target === m || e.target.closest("[data-shx]")) { shPickClose(); return; }
      const a = e.target.closest("[data-shapp]"); if (!a) return;
      const url = m.dataset.url, k = a.dataset.shapp;
      if (k === "copy") { shCopy(url); shPickClose(); return; }
      if (k === "more") { shPickClose(); navigator.share({ title: "My Biyahe trip", text: SH_TEXT, url }).catch(() => {}); return; }
      const app = SH_APPS.find(x => x.k === k); if (!app) return;
      if (app.copy) shCopy(url, true).then(ok => { if (ok) toast("Link copied too, in case " + app.n + " doesn't open"); });   // app links only work when that app is installed
      window.location.href = app.href(url, SH_TEXT);
      shPickClose();
    };
  }
  m.dataset.url = shUrl(token);
  m.innerHTML = `<div class="sheet shp"><div class="shp-h"><b>Send your trip link</b><button type="button" class="shp-x" data-shx aria-label="Close">&times;</button></div>
    <small class="shp-s">Pick the app. Only the person you send it to can follow your trip.</small>
    <div class="shp-g">${SH_APPS.map(a => `<button type="button" class="shp-b" data-shapp="${a.k}"><span class="shp-i" style="background:${a.c}"><svg viewBox="0 0 24 24" aria-hidden="true">${a.i}</svg></span><span>${a.n}</span></button>`).join("")}
    <button type="button" class="shp-b" data-shapp="copy"><span class="shp-i" style="background:var(--ink)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg></span><span>Copy link</span></button>
    ${navigator.share ? `<button type="button" class="shp-b" data-shapp="more"><span class="shp-i" style="background:var(--mute)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.500"/><circle cx="12" cy="12" r="1.500"/><circle cx="19" cy="12" r="1.500"/></svg></span><span>More apps</span></button>` : ""}</div></div>`;
  m.classList.add("on");
}
async function shStart(id, btn) {
  if (btn) btn.disabled = true;
  const { data: token, error } = await sb.rpc("create_trip_share", { p_booking: String(id) });
  if (error) { toast(error.message); if (btn) btn.disabled = false; return; }
  SH.set(String(id), token); shSync(); shRefresh();
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => { SHW.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; shLast = 0; shPush(); }, () => {}, { enableHighAccuracy: true, timeout: 10000 });
  shSend(id);   // opens the app picker right away (the Send link button opens it again later)
}
async function shStop(id, quiet) {
  id = String(id);
  SH.delete(id); SOS.delete(id); shSync(); shRefresh();
  const { error } = await sb.rpc("stop_trip_share", { p_booking: id });
  if (!quiet) toast(error ? error.message : "Stopped sharing. Your link no longer works.");
}

async function shSos(id, on) {
  id = String(id);
  if (on && !confirm("Send an SOS alert to the person you shared your trip with? They will see a red alert and your latest location.")) return;
  const { data, error } = await sb.rpc("share_sos", { p_booking: id, p_on: on });
  if (error || data === false) { toast(error ? error.message : "Sharing has ended."); return; }
  if (on) SOS.add(id); else SOS.delete(id);
  shRefresh();
  toast(on ? "SOS sent. If you are in danger, call 911." : "SOS cancelled.");
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-sh]"); if (!b) return;
  const id = b.dataset.b;
  if (b.dataset.sh === "start") shStart(id, b);
  else if (b.dataset.sh === "send") shSend(id);
  else if (b.dataset.sh === "stop") shStop(id);
  else if (b.dataset.sh === "sos") shSos(id, true);
  else if (b.dataset.sh === "sosoff") shSos(id, false);
});
