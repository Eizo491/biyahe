// Notification bell for customers and riders: in-app list, unread badge, chime + vibration.
// Built from live booking changes (Realtime). The list is kept per user in localStorage (last 30).
const NT = { uid: null, role: null, list: [], chan: null, seen: new Map(), ac: null, mute: false };
try { NT.mute = localStorage.getItem("biyahe-mute") === "1"; } catch (e) { /* storage blocked */ }
const ntKey = () => "biyahe-notif-" + NT.uid;
const ntSave = () => { try { localStorage.setItem(ntKey(), JSON.stringify(NT.list)); } catch (e) { /* ignore */ } };
const ntAC = () => { try { NT.ac = NT.ac || new (window.AudioContext || window.webkitAudioContext)(); if (NT.ac.state === "suspended") NT.ac.resume(); } catch (e) { /* no audio */ } return NT.ac; };
document.addEventListener("pointerdown", ntAC, { once: true });   // browsers only allow sound after a tap
document.querySelectorAll(".bell").forEach(b => b.insertAdjacentHTML("afterbegin", ico("bell")));

function ntChime() {
  if (NT.mute) return;
  const c = ntAC();
  if (c) [[880, 0], [1175, .15]].forEach(([f, t]) => {
    const o = c.createOscillator(), g = c.createGain(), s = c.currentTime + t;
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, s); g.gain.exponentialRampToValueAtTime(.25, s + .02); g.gain.exponentialRampToValueAtTime(.0001, s + .4);
    o.connect(g); g.connect(c.destination); o.start(s); o.stop(s + .45);
  });
  if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
}

// A loud 4-second two-tone alert + vibration, used when the customer's rider arrives. It ignores the in-app "Sound off"
// switch on purpose (the customer must not miss it). A web page can't override the phone's own silent mode or volume,
// and it can only ring while Biyahe is open (the first tap in the app unlocks sound).
function ntAlarm(ms = 4000) {
  const c = ntAC();
  if (navigator.vibrate) navigator.vibrate(Array.from({ length: Math.ceil(ms / 400) }, () => [300, 100]).flat());
  if (!c) return;
  const t0 = c.currentTime + .02, step = .25, n = Math.floor(ms / 1000 / step);
  for (let i = 0; i < n; i++) {
    const o = c.createOscillator(), g = c.createGain(), s = t0 + i * step;
    o.type = "square"; o.frequency.value = i % 2 ? 1175 : 880;
    g.gain.setValueAtTime(.0001, s); g.gain.exponentialRampToValueAtTime(.35, s + .02); g.gain.setValueAtTime(.35, s + step - .04); g.gain.exponentialRampToValueAtTime(.0001, s + step - .01);
    o.connect(g); g.connect(c.destination); o.start(s); o.stop(s + step);
  }
}

function ntPush(icon, title, body, quiet) {
  NT.list.unshift({ icon, title, body, at: Date.now(), read: false });
  NT.list = NT.list.slice(0, 30); ntSave(); ntBadge(); if (!quiet) ntChime(); ntBanner(icon, title, body); ntSys(title, body);
  document.querySelectorAll(".bell").forEach(b => { b.classList.add("ring"); setTimeout(() => b.classList.remove("ring"), 900); });
  if ($("#notif").classList.contains("open")) ntRender();
}
// ---------- Pop-ups at the top of the screen ----------
// App on screen: a banner slides down from the top. App in the background (or phone locked): a system notification, which the
// phone shows as a pop-up at the top of the screen. Needs the person to tap Allow once. With a push server set up (VAPID key) the server sends them instead.
let ntBT = 0;
function ntBanner(icon, title, body, o = {}) {
  let b = $("#ntbanner");
  if (!b) { b = document.createElement("div"); b.id = "ntbanner"; b.setAttribute("role", "alert"); document.body.appendChild(b); }
  clearTimeout(ntBT);
  b.innerHTML = `<span class="jc-ic">${ico(icon)}</span><div><b>${esc(title)}</b><small>${esc(body)}</small>${o.ask ? `<div class="ntb-a"><button type="button" data-ntb="yes">Allow</button><button type="button" data-ntb="no">Not now</button></div>` : ""}</div>`;
  b.classList.remove("show"); void b.offsetWidth; b.classList.add("show");
  b.onclick = async e => {
    const a = e.target.closest("[data-ntb]");
    if (a && a.dataset.ntb === "yes") { try { await pushOn(); toast("Notifications are on"); } catch (er) { toast(er.message || "Couldn't turn on notifications"); } }
    if (a) { try { localStorage.setItem("biyahe-alerts-ask", "1"); } catch (er) { /* ignore */ } }
    b.classList.remove("show");
    if (!a && !o.ask) ntOpen();   // tap the banner to open the notification list
  };
  ntBT = setTimeout(() => b.classList.remove("show"), o.ask ? 12000 : 5000);
}
async function ntSys(title, body) {
  try {
    if (!ALERTS_OK || Notification.permission !== "granted" || alertsPref() === "0" || document.visibilityState === "visible") return;
    if (PUSH_OK && await pushSub()) return;   // the push server already alerts this phone
    const reg = await navigator.serviceWorker.getRegistration(), o = { body, icon: "assets/icons/app-blue-192.png", badge: "assets/icons/app-blue-64.png", vibrate: [150, 80, 150], tag: "biyahe-" + Date.now(), data: { url: "index.html" } };
    if (reg) await reg.showNotification(title, o); else new Notification(title, o);
  } catch (e) { /* ignore */ }
}
function ntAsk() {   // once per phone: offer to turn notifications on
  if (!ALERTS_OK || Notification.permission !== "default" || !NT.uid) return;
  try { if (localStorage.getItem("biyahe-alerts-ask")) return; } catch (e) { return; }
  ntBanner("bell", "Turn on notifications?", "Get alerts at the top of your phone when your ride or a job updates.", { ask: true });
}
function ntBadge() {
  const n = NT.list.filter(x => !x.read).length;
  document.querySelectorAll(".bell .bdg").forEach(b => { b.hidden = !n; b.textContent = n > 9 ? "9+" : n; });
}
function ntRender() {
  const sb_ = $("#ntsound");
  sb_.querySelector("span").textContent = NT.mute ? "Sound off" : "Sound on";
  sb_.classList.toggle("off", NT.mute); sb_.setAttribute("aria-pressed", String(!NT.mute));
  $("#ntsi").innerHTML = NT.mute ? '<path d="M4 9.500v5h3.500L12 19V5L7.500 9.500z"/><path d="M16 9.500l5 5M21 9.500l-5 5"/>' : '<path d="M4 9.500v5h3.500L12 19V5L7.500 9.500z"/><path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11"/>';
  $("#ntclear").disabled = !NT.list.length;
  $("#ntlist").innerHTML = NT.list.length ? NT.list.map(x => `<div class="nt ${x.read ? "" : "new"}"><span class="jc-ic">${ico(x.icon)}</span><div><b>${esc(x.title)}</b><small>${esc(x.body)}</small><small>${timeAgo(x.at)}</small></div></div>`).join("") : `<div class="nt-empty"><span>${ico("bell")}</span><b>You're all caught up</b><small>Ride and order updates will show up here.</small></div>`;
}
function ntOpen() { pushUI(); ntRender(); $("#notif").classList.add("open"); NT.list.forEach(x => x.read = true); ntSave(); ntBadge(); }
function ntClose() { $("#notif").classList.remove("open"); ntRender(); }
document.addEventListener("click", e => { if (e.target.closest(".bell")) ntOpen(); });
$("#ntclose").onclick = ntClose;
$("#notif").onclick = e => { if (e.target.id === "notif") ntClose(); };
$("#ntclear").onclick = () => { NT.list = []; ntSave(); ntBadge(); ntRender(); };
$("#ntsound").onclick = () => { NT.mute = !NT.mute; try { localStorage.setItem("biyahe-mute", NT.mute ? "1" : "0"); } catch (e) { /* ignore */ } if (!NT.mute) ntChime(); ntRender(); };

// ---------- What triggers a notification ----------
function ntCustomer(p) {   // your booking changed
  const n = p.new; if (!n) return;
  const key = n.status + "|" + (n.details?.stage || ""), prev = NT.seen.get(String(n.id));
  NT.seen.set(String(n.id), key);
  if (p.eventType === "INSERT" || prev === key) return;
  const food = n.type === "food", rn = n.details?.restaurant?.name || "the store", st2 = n.details?.stage;
  const m = n.status === "cancelled" ? ["bag", "Booking cancelled", food ? `Your order from ${rn} was cancelled.` : "Your booking was cancelled."]
    : n.status === "done" ? ["check", food ? "Order delivered" : "Trip completed", "Thanks for using Biyahe. Rate your rider from Activity."]
    : n.status === "on_the_way" ? ["scooter", food ? "Order picked up" : "Trip started", food ? "Your rider is on the way to you." : "Enjoy your ride."]
    : n.status === "accepted" && st2 === "at_rest" ? ["food", "Rider at the restaurant", `Your rider is collecting your order at ${rn}.`]
    : n.status === "accepted" ? ["scooter", "Rider accepted", food ? `Your rider is heading to ${rn}.` : "Your rider is on the way."] : null;
  if (m) ntPush(...m);
}
function ntRider(p) {   // a new job appeared, or a customer cancelled yours
  const n = p.new; if (!n) return;
  if (p.eventType === "INSERT" && n.status === "searching") {
    if (rOnline) ntPush(JOB_ICON[n.type] || "bag", "New job available", `${LABEL[n.type] || "Job"} · ${peso(n.amount)} · ${n.type === "food" && n.details?.restaurant ? n.details.restaurant.name + " → " : ""}${n.dropoff || ""}`);
  } else if (p.eventType === "UPDATE" && n.status === "cancelled" && n.rider_id === NT.uid && NT.seen.get(String(n.id)) !== "cancelled") {
    NT.seen.set(String(n.id), "cancelled");
    ntPush("bag", "Job cancelled", `The customer cancelled: ${n.details?.summary || n.dropoff || "a booking"}.`);
  }
}

function ntStart(user, role) {
  if (NT.chan && NT.uid === user.id && NT.role === role) return;
  ntStop();
  Object.assign(NT, { uid: user.id, role });
  try { NT.list = JSON.parse(localStorage.getItem(ntKey()) || "[]"); } catch (e) { NT.list = []; }
  ntBadge(); ntRender(); pushSync(); setTimeout(ntAsk, 2500);
  if (role === "customer") sb.from("bookings").select("id,status,details").then(({ data }) => (data || []).forEach(b => NT.seen.set(String(b.id), b.status + "|" + (b.details?.stage || ""))));
  NT.chan = sb.channel("notif-" + role + "-" + user.id).on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, p => role === "customer" ? ntCustomer(p) : ntRider(p)).subscribe();
}
function ntStop() {
  if (NT.chan) { sb.removeChannel(NT.chan); NT.chan = null; }
  NT.uid = null; NT.role = null; NT.list = []; NT.seen.clear();
  document.querySelectorAll(".bell .bdg").forEach(b => b.hidden = true);
  $("#notif").classList.remove("open");
}
