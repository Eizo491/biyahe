// Keeps the rider's screen on while a job is active (phone browsers pause GPS once the screen turns off or the app is hidden),
// restarts GPS when the app comes back, and shows a small "GPS live" pill so you can see the location really is updating.
const WL = { lock: null, pill: null, tick: null };
async function wlGet() {
  try { if ("wakeLock" in navigator && !WL.lock && document.visibilityState === "visible") { WL.lock = await navigator.wakeLock.request("screen"); WL.lock.addEventListener("release", () => { WL.lock = null; }); } } catch (e) { /* not allowed (e.g. battery saver) */ }
}
function wlOn() {
  wlGet();
  if (!WL.pill) { WL.pill = document.createElement("div"); WL.pill.id = "gpspill"; document.body.appendChild(WL.pill); }
  clearInterval(WL.tick);
  WL.tick = setInterval(() => {
    const t = TRK.last && TRK.last.t, s = t ? Math.round((Date.now() - t) / 1000) : null;
    WL.pill.className = s == null || s > 20 ? "bad" : "";
    WL.pill.textContent = s == null ? "GPS: waiting for signal…" : s > 20 ? `GPS paused ${s}s. Keep Biyahe open` : `GPS live · ${TRK.last.lat.toFixed(5)}, ${TRK.last.lng.toFixed(5)} · ${s}s ago`;
  }, 1000);
}
function wlOff() { clearInterval(WL.tick); WL.tick = null; if (WL.pill) { WL.pill.remove(); WL.pill = null; } if (WL.lock) { WL.lock.release(); WL.lock = null; } }
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !WL.tick) return;
  wlGet();
  if (TRK.watch != null && TRK.watch !== "native") { navigator.geolocation.clearWatch(TRK.watch); TRK.watch = null; clearInterval(TRK.timer); TRK.timer = null; trkSync(); }   // GPS may have been frozen while hidden
});
