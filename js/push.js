// Phone alerts (Web Push): subscribe this device and link it to the signed-in user. The server side is supabase/functions/push.
const PUSH_OK = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!VAPID_PUBLIC_KEY;
const ALERTS_OK = "serviceWorker" in navigator && "Notification" in window;   // phone pop-ups (works without a push server)
const alertsPref = () => { try { return localStorage.getItem("biyahe-alerts"); } catch (e) { return null; } };
const alertsSet = v => { try { localStorage.setItem("biyahe-alerts", v); } catch (e) { /* ignore */ } };
const pushKey = s => Uint8Array.from(atob((s + "=".repeat((4 - s.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
const pushSub = async () => { const reg = await navigator.serviceWorker.getRegistration(); return reg ? reg.pushManager.getSubscription() : null; };

async function pushSave(sub) {   // (re)link this device to whoever is signed in now
  const j = sub.toJSON();
  const { error } = await sb.rpc("save_push_subscription", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_role: NT.role || "customer" });
  if (error) throw error;
}
async function pushSync() { if (PUSH_OK && Notification.permission === "granted") { try { const s = await pushSub(); if (s) await pushSave(s); } catch (e) { /* retry next sign-in */ } } }

async function pushOn() {
  if (await Notification.requestPermission() !== "granted") throw new Error("Notifications are blocked. Allow them in your browser settings.");
  const reg = await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready;
  alertsSet("1");
  if (!PUSH_OK) return;   // no push server set up: alerts pop up while Biyahe is open or in the background
  const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKey(VAPID_PUBLIC_KEY) });
  await pushSave(sub);
}
async function pushOff(full) {   // sign-out: unlink from this account; full = also turn the device subscription off
  try { const s = await pushSub(); if (s) { await sb.rpc("remove_push_subscription", { p_endpoint: s.endpoint }); if (full) await s.unsubscribe(); } } catch (e) { /* ignore */ }
}

async function pushUI() {   // the phone-alerts switch inside the notifications sheet
  const b = $("#ntpush");
  if (!ALERTS_OK) { b.hidden = true; return; }   // this browser can't show notifications
  const denied = Notification.permission === "denied", on = !denied && Notification.permission === "granted" && alertsPref() !== "0" && (!PUSH_OK || !!(await pushSub()));
  b.hidden = false; b.disabled = denied; b.classList.remove("busy"); b.classList.toggle("on", on);
  b.setAttribute("aria-checked", String(on));
  b.innerHTML = `<span class="ntp-ic">${ico("bell")}</span><span class="ntp-t"><b>Phone alerts</b><small>${denied ? "Blocked. Allow notifications in your browser settings." : on ? (PUSH_OK ? "On. You'll be alerted even when the app is closed." : "On. Alerts pop up at the top of your phone.") : "Get alerts that pop up at the top of your phone."}</small></span><span class="ntp-sw"><i></i></span>`;
}
$("#ntpush").onclick = async () => {
  const b = $("#ntpush"); b.disabled = true; b.classList.add("busy");
  try { if (b.classList.contains("on")) { alertsSet("0"); await pushOff(true); } else await pushOn(); } catch (e) { toast(e.message || "Couldn't change phone alerts"); }
  pushUI();
};
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
