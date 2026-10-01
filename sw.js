// Biyahe service worker: shows phone notifications sent by the push Edge Function, even when the app is closed.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json(); } catch (_) { d = { title: "Biyahe", body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.some(w => w.visibilityState === "visible")) return;   // app is open on screen: the in-app bell already alerts
    await self.registration.showNotification(d.title || "Biyahe", {
      body: d.body || "", tag: d.tag, icon: "assets/icons/app-blue-192.png", badge: "assets/icons/app-blue-64.png",
      vibrate: [150, 80, 150], data: { url: d.url || "index.html" }
    });
  })());
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins[0]) { await wins[0].focus(); return; }
    await clients.openWindow(e.notification.data.url);
  })());
});
