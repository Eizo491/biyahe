// Owner console (desktop layout): overview, rider applications, riders (jobs + reviews), feedback.
// Data comes from admin_* functions in supabase/admin-dashboard.sql and supabase/rider-stats.sql, which refuse non-admins.
let aFresh = true, aTab = "over", aChan = null, aTimer = null, aKick = null, aOnline = new Set(), aFilter = "all", aFb = "app", aDrawer = null;
let aAl = "open", aAlN = -1, aTrail = null;   // route alerts: filter, last open count (for the "new alert" toast), trail map
let aLock = 0, aDirty = false; // aLock > 0 while a row is animating out: hold re-renders so the animation isn't cut short
let aData = { apps: [], fb: [], riders: [], reviews: [], alerts: [], alertsErr: null };
const TITLES = { over: "Overview", apps: "Applications", riders: "Riders", alerts: "Route alerts", fb: "Feedback" };
const AL_KIND = { off_route: "Off the planned route", wrong_way: "Heading the wrong way", long_stop: "Long stop mid-trip", detour: "Long detour", gps_jump: "GPS jumped", gps_silent: "GPS went silent", ended_far: "Ended far from drop-off" };
const AL_SEV = { high: ["High", "bad"], warn: ["Check", ""], info: ["Info", "ok"] };
const APP_TAG = { pending: ["Pending", ""], approved: ["Approved", "ok"], rejected: ["Rejected", "bad"] };
const when = t => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const ago = t => {
  if (!t) return "never";
  const m = Math.round((Date.now() - new Date(t)) / 6e4);
  return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago";
};
const isOn = r => aOnline.has(r.user_id);
const wait = ms => new Promise(r => setTimeout(r, ms));
const stars = n => `<span class="stars" aria-label="${n} out of 5">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>`;
const rateCell = r => r.review_count ? `${stars(Math.round(r.avg_rating))} <b>${Number(r.avg_rating).toFixed(1)}</b><small>${r.review_count} review${r.review_count > 1 ? "s" : ""}</small>` : `—<small>No reviews yet</small>`;

async function loadAdmin() {
  if (aLock) { aDirty = true; return; }
  await sb.rpc("route_scan_silent");   // flags trips in progress whose GPS has gone quiet (ignored if route-watch.sql isn't installed)
  const [a, f, r, v, al] = await Promise.all([sb.rpc("admin_list_applications"), sb.rpc("admin_list_feedback"), sb.rpc("admin_list_riders"), sb.rpc("admin_list_rider_reviews"), sb.rpc("admin_list_route_alerts")]);
  if (aLock) { aDirty = true; return; }
  const err = a.error || f.error || r.error || v.error;
  if (err) { $("#alist").innerHTML = `<div class="empty">${esc(err.message)}<br>Did you run supabase/admin-dashboard.sql and supabase/rider-stats.sql?</div>`; return; }
  aData = { apps: a.data, fb: f.data, riders: r.data, reviews: v.data, alerts: al.error ? [] : al.data, alertsErr: al.error ? al.error.message : null };
  const open = aData.alerts.filter(x => !x.resolved_at).length;
  if (aAlN >= 0 && open > aAlN) toast("New route alert: " + open + " to review");
  aAlN = open;
  renderAdmin(aFresh); aFresh = false;
}
const kick = () => { clearTimeout(aKick); aKick = setTimeout(loadAdmin, 300); };

function appsTable(list) {
  if (!list.length) return `<div class="empty">Nothing here.</div>`;
  return `<div class="tw"><table class="tbl"><thead><tr><th>Applicant</th><th>Vehicle</th><th>Contact</th><th>Applied</th><th>Status</th><th></th></tr></thead><tbody>${list.map(x => {
    const [label, cls] = APP_TAG[x.status] || [x.status, ""];
    const btns = x.status === "pending" ? `<button class="go" data-u="${x.user_id}" data-ok="1">Approve</button><button class="no" data-u="${x.user_id}" data-ok="0">Reject</button>`
      : x.status === "approved" ? `<button class="no" data-u="${x.user_id}" data-ok="0">Remove rider</button>`
      : `<button class="go" data-u="${x.user_id}" data-ok="1">Approve instead</button>`;
    return `<tr><td><b>${esc(x.full_name)}</b><small>${esc(x.email)}</small></td><td>${esc(x.vehicle)}<small>${esc(x.plate)}</small></td><td>${esc(x.phone)}</td><td>${when(x.created_at)}</td><td><span class="tag ${cls}">${label}</span></td><td><div class="btns">${btns}</div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function ridersView() {
  const list = aData.riders.filter(r => aFilter === "all" || (aFilter === "on") === isOn(r));
  const on = aData.riders.filter(isOn).length;
  const chips = [["all", `All (${aData.riders.length})`], ["on", `Online (${on})`], ["off", `Offline (${aData.riders.length - on})`]]
    .map(([k, l]) => `<button data-f="${k}" class="${aFilter === k ? "on" : ""}">${l}</button>`).join("");
  const rows = list.map(r => `<tr class="click" data-r="${r.user_id}"><td><b>${esc(r.full_name || r.email)}</b><small>${esc(r.email)}</small></td><td>${esc(r.vehicle || "—")}<small>${esc(r.plate || "")}</small></td><td>${esc(r.phone || "—")}</td>
    <td><span class="dot ${isOn(r) ? "on" : ""}"></span>${isOn(r) ? "<b>Online</b>" : "Offline"}<small>${isOn(r) ? "Working now" : "Last seen " + ago(r.last_seen)}</small></td>
    <td><b class="big">${r.jobs_done}</b><small>${r.jobs_active ? r.jobs_active + " in progress" : "jobs done"}</small></td><td>${rateCell(r)}</td>
    <td><div class="btns"><button data-r="${r.user_id}">Details</button><button class="no" data-u="${r.user_id}" data-ok="0">Remove rider</button></div></td></tr>`).join("");
  return `<div class="chips">${chips}</div>` + (list.length ? `<div class="tw"><table class="tbl"><thead><tr><th>Rider</th><th>Vehicle</th><th>Phone</th><th>Status</th><th>Jobs done</th><th>Rating</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">No riders in this view.</div>`);
}

function alertsView() {
  if (aData.alertsErr) return `<div class="empty">${esc(aData.alertsErr)}<br>Did you run supabase/route-watch.sql?</div>`;
  const open = aData.alerts.filter(x => !x.resolved_at), done = aData.alerts.filter(x => x.resolved_at);
  const chips = [["open", `To review (${open.length})`], ["done", `Reviewed (${done.length})`]].map(([k, l]) => `<button data-al="${k}" class="${aAl === k ? "on" : ""}">${l}</button>`).join("");
  const list = aAl === "open" ? open : done;
  const intro = `<p class="dsub">Biyahe compares each rider's live GPS trail with the trip they accepted. A flag is a reason to look, not proof of anything: traffic, road closures or a customer's request can cause the same pattern.</p>`;
  if (!list.length) return intro + `<div class="chips">${chips}</div><div class="empty">${aAl === "open" ? "Nothing suspicious right now." : "No reviewed alerts yet."}</div>`;
  return intro + `<div class="chips">${chips}</div><div class="tw"><table class="tbl"><thead><tr><th>Flag</th><th>Rider</th><th>Trip</th><th>What we saw</th><th>When</th><th></th></tr></thead><tbody>${list.map(x => {
    const [sl, sc] = AL_SEV[x.severity] || ["Check", ""];
    return `<tr><td><span class="tag ${sc}">${sl}</span><small>${esc(AL_KIND[x.kind] || x.kind)}</small></td><td><b>${esc(x.rider_name || x.rider_email)}</b><small>${esc(x.plate || x.rider_email)}</small></td><td>${esc(x.summary || "—")}</td><td class="msg">${esc(x.message)}${x.note ? `<small>Note: ${esc(x.note)}</small>` : ""}</td><td>${ago(x.created_at)}</td>
      <td><div class="btns"><button data-al-view="${x.id}">View route</button>${x.resolved_at ? "" : `<button class="go" data-al-ok="${x.id}">Mark reviewed</button>`}</div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function fbView() {
  const chips = [["app", `App feedback (${aData.fb.length})`], ["riders", `Rider reviews (${aData.reviews.length})`]]
    .map(([k, l]) => `<button data-fb="${k}" class="${aFb === k ? "on" : ""}">${l}</button>`).join("");
  if (aFb === "riders") {
    return `<div class="chips">${chips}</div>` + (aData.reviews.length ? `<div class="tw"><table class="tbl"><thead><tr><th>Rider</th><th>Reviewed by</th><th>Rating</th><th>Comment</th><th>Job</th><th>Date</th></tr></thead><tbody>${aData.reviews.map(x => `<tr>
      <td><b>${esc(x.rider_name || x.rider_email)}</b><small>${esc(x.rider_email)}</small></td><td><b>${esc(x.customer_name || x.customer_email)}</b><small>${esc(x.customer_email)}</small></td>
      <td>${stars(x.rating)}</td><td class="msg">${esc(x.comment || "—")}</td><td>${esc(x.booking_summary || x.booking_type || "—")}</td><td>${when(x.created_at)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No rider reviews yet. Customers can rate a rider once a job is done.</div>`);
  }
  return `<div class="chips">${chips}</div>` + (aData.fb.length ? `<div class="tw"><table class="tbl"><thead><tr><th>From</th><th>Role</th><th>Rating</th><th>Message</th><th>Date</th></tr></thead><tbody>${aData.fb.map(x => `<tr>
    <td><b>${esc(x.full_name || x.email)}</b><small>${esc(x.email)}</small></td><td><span class="tag">${esc(x.role || "customer")}</span></td>
    <td>${x.rating ? stars(x.rating) : "—"}</td><td class="msg">${esc(x.message)}</td><td>${when(x.created_at)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No feedback yet.</div>`);
}

function overView() {
  const pending = aData.apps.filter(x => x.status === "pending");
  const rated = aData.fb.filter(x => x.rating), avg = rated.length ? (rated.reduce((s, x) => s + x.rating, 0) / rated.length).toFixed(1) + " ★" : "—";
  const jobs = aData.riders.reduce((s, r) => s + r.jobs_done, 0);
  const stat = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
  return `<div class="stats">${stat(pending.length, "Applications waiting")}${stat(aData.riders.length, "Riders in the company")}${stat(aData.riders.filter(isOn).length, "Online now")}${stat(aData.alerts.filter(x => !x.resolved_at).length, "Route alerts to review")}${stat(jobs, "Jobs completed")}${stat(aData.fb.length, "App feedback · avg " + avg)}</div>
    <h3>Waiting for your approval</h3>${pending.length ? appsTable(pending) : `<div class="empty">No pending applications.</div>`}`;
}

// ---------- Rider details panel: jobs, customer reviews of the rider, and what the rider said about the app ----------
function drawerBody(r) {
  const rev = aData.reviews.filter(x => x.rider_id === r.user_id), mine = aData.fb.filter(x => x.user_id === r.user_id);
  const stat = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
  const card = (top, text, foot) => `<div class="fbc"><div class="row">${top}</div><p>${esc(text)}</p><small>${foot}</small></div>`;
  return `<h2>${esc(r.full_name || r.email)}</h2>
    <p class="dsub"><span class="dot ${isOn(r) ? "on" : ""}"></span>${isOn(r) ? "Online now" : "Last seen " + ago(r.last_seen)} · ${esc(r.vehicle || "—")} ${esc(r.plate || "")}<br>${esc(r.email)} · ${esc(r.phone || "no phone")}</p>
    <div class="stats dstats">${stat(r.jobs_done, "Jobs done")}${stat(r.jobs_active, "In progress")}${stat(r.review_count ? Number(r.avg_rating).toFixed(1) + " ★" : "—", "Average rating")}${stat(r.review_count, "Reviews")}</div>
    <h3>What customers said about this rider</h3>
    ${rev.length ? rev.map(x => card(`${stars(x.rating)}<small>${when(x.created_at)}</small>`, x.comment || "No comment left.", `${esc(x.customer_name || x.customer_email)}${x.booking_summary ? " · " + esc(x.booking_summary) : ""}`)).join("") : `<div class="empty">No reviews yet.</div>`}
    <h3>Feedback from this rider about the app</h3>
    ${mine.length ? mine.map(x => card(`${x.rating ? stars(x.rating) : "<small>No rating</small>"}<small>${when(x.created_at)}</small>`, x.message, "")).join("") : `<div class="empty">Nothing sent yet.</div>`}`;
}
function renderDrawer() {
  const d = $("#adrawer"), r = aData.riders.find(x => x.user_id === aDrawer);
  if (!aDrawer || aTrail) return;   // the route-alert map keeps its own content
  if (!r) { closeDrawer(); return; }
  const p = d.querySelector(".dpanel"), top = p.scrollTop;
  d.querySelector(".dbody").innerHTML = drawerBody(r); p.scrollTop = top;
}
function openDrawer(id) {
  aDrawer = id;
  const d = $("#adrawer");
  d.innerHTML = `<div class="dbg"></div><aside class="dpanel" role="dialog" aria-modal="true"><button class="dx" type="button" aria-label="Close">×</button><div class="dbody"></div></aside>`;
  d.classList.remove("leave"); d.classList.add("open");
  renderDrawer();
}
// ---------- Route alert: planned route vs. the rider's real GPS trail on a map ----------
async function openTrail(id) {
  const a = aData.alerts.find(x => x.id === id);
  if (!a) return;
  closeDrawer(true);
  aDrawer = "alert:" + id; aTrail = { map: null };
  const d = $("#adrawer");
  d.innerHTML = `<div class="dbg"></div><aside class="dpanel" role="dialog" aria-modal="true"><button class="dx" type="button" aria-label="Close">×</button><div class="dbody">
    <h2>${esc(AL_KIND[a.kind] || a.kind)}</h2><p class="dsub">${esc(a.rider_name || a.rider_email)} · ${esc(a.plate || "")}<br>${esc(a.message)}</p>
    <div id="amap" class="amap"></div><p class="dsub" id="amapnote">Loading the trail…</p>
    <p class="dsub"><span class="lg planned"></span>Planned route (pickup → drop-off) <span class="lg trail"></span>Rider's actual trail <span class="lg flag"></span>Where it was flagged</p>
    ${a.resolved_at ? "" : `<button class="go" data-al-ok="${a.id}" type="button">Mark reviewed</button>`}</div></aside>`;
  d.classList.remove("leave"); d.classList.add("open");
  const { data, error } = await sb.rpc("admin_trip_track", { p_booking: a.booking_id });
  if (!aTrail || aDrawer !== "alert:" + id) return;   // closed while loading
  if (error) { $("#amapnote").textContent = error.message; return; }
  const pts = (data.points || []).map(p => [p[0], p[1]]);
  const m = L.map("amap", { zoomControl: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
  const all = [];
  if (data.from && data.to) {
    const f = [data.from.lat, data.from.lng], t = [data.to.lat, data.to.lng];
    L.polyline([f, t], { color: "#178a4c", weight: 4, dashArray: "8 8", opacity: .9 }).addTo(m);
    L.circleMarker(f, { radius: 7, color: "#178a4c", fillOpacity: 1 }).addTo(m).bindTooltip("Pickup", { permanent: true, direction: "top" });
    L.circleMarker(t, { radius: 7, color: "#1f4fd8", fillOpacity: 1 }).addTo(m).bindTooltip("Drop-off", { permanent: true, direction: "top" });
    all.push(f, t);
  }
  if (pts.length) { L.polyline(pts, { color: "#d23b3b", weight: 4, opacity: .9 }).addTo(m); all.push(...pts); }
  if (a.lat != null) { L.circleMarker([a.lat, a.lng], { radius: 9, color: "#111", weight: 3, fillColor: "#ffb400", fillOpacity: 1 }).addTo(m); all.push([a.lat, a.lng]); }
  if (all.length) m.fitBounds(L.latLngBounds(all), { padding: [30, 30], maxZoom: 17 }); else m.setView([12.3541, 121.0689], 13);
  aTrail.map = m;
  $("#amapnote").textContent = pts.length ? `${pts.length} GPS points recorded${data.from ? "" : " · this job has no planned route (package job)"}.` : "No GPS points were recorded for this trip.";
  setTimeout(() => m.invalidateSize(), 60);
}
async function resolveAlert(b, id) {
  const note = prompt("Optional note (for example: customer asked for a stop, road closed):", "");
  if (note === null) return;
  b.disabled = true;
  const { error } = await sb.rpc("admin_resolve_route_alert", { p_alert: id, p_note: note });
  if (error) { toast(error.message); b.disabled = false; return; }
  toast("Marked as reviewed");
  if (aTrail) closeDrawer();
  loadAdmin();
}

function closeDrawer(quick) {
  const d = $("#adrawer");
  aDrawer = null;
  if (aTrail) { if (aTrail.map) aTrail.map.remove(); aTrail = null; }
  if (quick) { d.className = ""; d.innerHTML = ""; return; }
  if (!d.classList.contains("open")) return;
  d.classList.add("leave");
  setTimeout(() => { if (!aDrawer) { d.classList.remove("open", "leave"); d.innerHTML = ""; } }, 280);
}
$("#adrawer").onclick = e => {
  if (e.target.closest(".dx") || e.target.classList.contains("dbg")) closeDrawer();
  const ok = e.target.closest("[data-al-ok]"); if (ok) resolveAlert(ok, ok.dataset.alOk);
};
document.addEventListener("keydown", e => { if (e.key === "Escape" && aDrawer) closeDrawer(); });

function renderAdmin(animate) {
  const pending = aData.apps.filter(x => x.status === "pending").length;
  document.querySelector('#anav [data-t="apps"]').innerHTML = `Applications${pending ? `<span class="n">${pending}</span>` : ""}`;
  const nal = aData.alerts.filter(x => !x.resolved_at).length;
  document.querySelector('#anav [data-t="alerts"]').innerHTML = `Route alerts${nal ? `<span class="n">${nal}</span>` : ""}`;
  $("#atitle").textContent = TITLES[aTab];
  $("#alist").innerHTML = aTab === "over" ? overView() : aTab === "apps" ? appsTable(aData.apps) : aTab === "riders" ? ridersView() : aTab === "alerts" ? alertsView() : fbView();
  $("#alist").classList.toggle("fresh", !!animate);
  renderDrawer();
  if (!animate) return;
  const t = $("#atitle"); t.classList.remove("pop"); void t.offsetWidth; t.classList.add("pop");
  document.querySelectorAll("#alist .stat, #alist .tbl tbody tr").forEach((el, i) => el.style.setProperty("--i", Math.min(i, 14)));
  document.querySelectorAll("#alist .stat b").forEach(el => {   // count up the big numbers
    const n = +el.textContent; if (!n) return;
    const t0 = performance.now(), step = now => { const k = Math.min(1, (now - t0) / 700); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

// ---------- Approve / reject / remove, with animation ----------
// 1. the button shows a spinner, 2. it turns into a check ("Removed"), 3. the row slides out and folds shut, 4. the list reloads.
async function collapseRow(row, kind) {
  const cells = [...row.children].map(td => {
    const w = document.createElement("div"); w.className = "cw";
    w.append(...td.childNodes); td.append(w);
    return w;
  });
  cells.forEach(w => { w.style.height = w.offsetHeight + "px"; });
  void row.offsetWidth;                      // lock the starting height, then let CSS transition to 0
  row.classList.add("gone", kind);
  await wait(950);
}

async function reviewApp(b, ok) {
  const row = b.closest("tr"), leaves = aTab !== "apps";   // in the Applications tab the row stays and just changes status
  aLock++;
  row.querySelectorAll("button").forEach(x => x.disabled = true);
  b.classList.add("working");
  const [{ error }] = await Promise.all([sb.rpc("admin_review_application", { p_user: b.dataset.u, p_approve: ok }), wait(700)]);
  if (error) {
    b.classList.remove("working"); row.querySelectorAll("button").forEach(x => x.disabled = false);
    toast(error.message); aLock--; if (aDirty) { aDirty = false; loadAdmin(); }
    return;
  }
  b.classList.remove("working"); b.classList.add("done");
  b.textContent = (ok ? "Approved" : "Removed") + " ✓";
  await wait(500);
  if (leaves) await collapseRow(row, ok ? "yes" : "no");
  toast(ok ? "Rider approved" : "Rider removed / application rejected");
  aLock--; aDirty = false;
  loadAdmin();
}

$("#alist").onclick = e => {
  if (aLock) return;
  const f = e.target.closest("button[data-f]");
  if (f) { aFilter = f.dataset.f; renderAdmin(true); return; }
  const al = e.target.closest("button[data-al]");
  if (al) { aAl = al.dataset.al; renderAdmin(true); return; }
  const av = e.target.closest("button[data-al-view]");
  if (av) { openTrail(av.dataset.alView); return; }
  const ao = e.target.closest("button[data-al-ok]");
  if (ao) { resolveAlert(ao, ao.dataset.alOk); return; }
  const fb = e.target.closest("button[data-fb]");
  if (fb) { aFb = fb.dataset.fb; renderAdmin(true); return; }
  const b = e.target.closest("button[data-u]");
  if (b) {
    const ok = b.dataset.ok === "1";
    if (!ok && !confirm("Reject / remove this rider? They go back to a normal customer account.")) return;
    reviewApp(b, ok);
    return;
  }
  const r = e.target.closest("[data-r]");
  if (r) openDrawer(r.dataset.r);
};

$("#anav").onclick = e => {
  const b = e.target.closest("button");
  if (!b || aLock) return;
  aTab = b.dataset.t;
  document.querySelectorAll("#anav button").forEach(x => x.classList.toggle("on", x === b));
  renderAdmin(true);
};

function startAdmin(user) {
  loadAdmin(); // the wide layout is switched on by UI.swap when the console replaces the login screen
  if (!aChan) {
    aChan = sb.channel("riders-online", { config: { presence: { key: "admin-" + user.id } } })
      .on("presence", { event: "sync" }, () => { aOnline = new Set(Object.keys(aChan.presenceState())); if (aData.riders.length && !aLock) renderAdmin(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "rider_applications" }, kick)
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, kick)
      .on("postgres_changes", { event: "*", schema: "public", table: "rider_reviews" }, kick)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, kick)
      .on("postgres_changes", { event: "*", schema: "public", table: "route_alerts" }, kick)
      .subscribe();
  }
  if (!aTimer) aTimer = setInterval(loadAdmin, 60000); // refresh "last seen"
}

function stopAdmin() {
  if (aChan) { sb.removeChannel(aChan); aChan = null; }
  if (aTimer) { clearInterval(aTimer); aTimer = null; }
  clearTimeout(aKick);
  aTab = "over"; aFilter = "all"; aFb = "app"; aDrawer = null; aLock = 0; aDirty = false; aOnline = new Set(); aData = { apps: [], fb: [], riders: [], reviews: [], alerts: [], alertsErr: null }; aAl = "open"; aAlN = -1;
  if (aTrail) { if (aTrail.map) aTrail.map.remove(); aTrail = null; }
  const d = $("#adrawer"); d.className = ""; d.innerHTML = "";
  document.querySelectorAll("#anav button").forEach(b => b.classList.toggle("on", b.dataset.t === "over"));
  $("#alist").innerHTML = ""; aFresh = true;
  const so = $("#aout"); so.classList.remove("busy"); so.querySelector("span").textContent = "Sign out";
}
