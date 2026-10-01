// Rider dashboard: earnings + stats, online switch, job cards (open / mine), accept and advance status.
// Names are prefixed (JOB_*, job*) because the customer app shares this page.
const LABEL = { ride: "Ride", food: "Food delivery", delivery: "Package" };
const JOB_ICON = { ride: "scooter", food: "bag", delivery: "box" };
const JOB_STATUS = { searching: "Open", accepted: "Accepted", on_the_way: "On the way", done: "Completed", cancelled: "Cancelled" };
// Next button: [new status, label, stage]. Food jobs have extra steps the customer sees live.
const nextFor = j => j.type === "food"
  ? (j.status === "on_the_way" ? ["done", "Mark delivered"] : j.status === "accepted" ? (j.details?.stage === "at_rest" ? ["on_the_way", "Picked up · deliver now", "to_you"] : ["accepted", "Arrived at restaurant", "at_rest"]) : null)
  : ({ accepted: ["on_the_way", "Start trip"], on_the_way: ["done", "Mark done"] })[j.status] || null;
let jobSig = "", jobPoll = null;   // jobSig: what the list on screen was drawn from (so a refresh that changes nothing doesn't redraw it)
let jobTab = "open", me = null, jobChan = null, jobData = new Map(), rOnline = true, statsAt = 0, rStats = { today: 0, trips: 0, week: 0, rate: null };
const isActive = j => j.status === "accepted" || j.status === "on_the_way";
const timeAgo = t => { const m = Math.max(0, Math.round((Date.now() - new Date(t)) / 60000)); return m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.floor(m / 60) + " h ago"; };

// ---------- Earnings + stats ----------
async function loadStats() {
  if (!me) return;
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [b, rv] = await Promise.all([sb.from("bookings").select("amount,created_at").eq("rider_id", me.id).eq("status", "done").gte("created_at", since), sb.from("rider_reviews").select("rating")]);
  const day = new Date().toDateString(), rows = b.data || [], td = rows.filter(x => new Date(x.created_at).toDateString() === day), rs = (rv.data || []).map(x => x.rating);
  rStats = { today: td.reduce((s, x) => s + +x.amount, 0), trips: td.length, week: rows.reduce((s, x) => s + +x.amount, 0), rate: rs.length ? (rs.reduce((a, c) => a + c, 0) / rs.length).toFixed(1) : null };
  renderDash();
}
function renderDash() {
  $("#rdash").innerHTML = `<div class="rd"><div class="rd-top"><div><small>Today's earnings</small><b>${peso(rStats.today)}</b></div>
    <button type="button" id="ronline" class="sw ${rOnline ? "on" : ""}" role="switch" aria-checked="${rOnline}"><i></i>${rOnline ? "Online" : "Offline"}</button></div>
    <div class="rd-stats"><div><b>${rStats.trips}</b><span>Trips today</span></div><div><b>${rStats.rate ? "★ " + rStats.rate : "–"}</b><span>Rating</span></div><div><b>${peso(rStats.week)}</b><span>Last 7 days</span></div></div><p class="rt-note">For everyone's safety, your route is checked against the planned trip while a job is in progress.</p></div>`;
}
$("#rdash").onclick = e => {
  if (!e.target.closest("#ronline")) return;
  rOnline = !rOnline;
  if (presChan) rOnline ? presChan.track({ at: Date.now() }) : presChan.untrack();
  renderDash(); loadJobs();
};

// ---------- Job cards ----------
function jobCard(j) {
  const d = j.details || {}, nx = nextFor(j), act = isActive(j), food = j.type === "food";
  const from = food ? d.restaurant?.name || j.pickup : j.pickup, items = food && d.items?.length ? d.items.map(i => `${i.q}× ${esc(i.name)}`).join(", ") : "";
  return `<article class="jc ${act ? "act" : ""}">
    <div class="jc-h"><span class="jc-ic">${ico(JOB_ICON[j.type])}</span><div><b>${LABEL[j.type]}</b><small>${timeAgo(j.created_at)}${d.km ? ` · ${d.km} km` : ""}</small></div>
      <div class="jc-fare"><b>${peso(j.amount)}</b>${j.status !== "searching" ? `<span class="tag ${j.status === "done" ? "ok" : ""}">${JOB_STATUS[j.status]}</span>` : ""}</div></div>
    <div class="jc-route"><div><i></i><span><small>${food ? "Pick up" : "From"}</small>${esc(from || "Customer's location")}</span></div><div><i class="rt-b"></i><span><small>Drop off</small>${esc(j.dropoff || "")}</span></div></div>
    ${items ? `<p class="jc-items">${items}</p>` : ""}
    ${j.status === "searching" ? `<button class="cta" data-accept="${j.id}">Accept job · ${peso(j.amount)}</button>`
      : act ? `<div class="jc-btns">${food ? `<button class="cta alt" data-map="${j.id}">${ico("nav")}Live map</button>` : j.type === "ride" && d.pickup_geo ? `<a class="cta alt" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${(j.status === "on_the_way" ? d.dropoff_geo : d.pickup_geo).lat},${(j.status === "on_the_way" ? d.dropoff_geo : d.pickup_geo).lng}&travelmode=two-wheeler">${ico("nav")}Navigate</a>` : ""}${nx ? `<button class="cta" data-id="${j.id}" data-s="${nx[0]}" data-g="${nx[2] || ""}">${nx[1]}</button>` : ""}</div>` : ""}
  </article>`;
}

async function loadJobs(quiet) {   // quiet = a background refresh: skip the redraw when nothing changed
  if (!me) return;
  if (!quiet) { if (Date.now() - statsAt > 10000) { statsAt = Date.now(); loadStats(); } else renderDash(); }
  if (jobTab === "open" && !rOnline) { jobSig = ""; jobData = new Map(); $("#rlist").innerHTML = `<div class="empty">You're offline. Switch to Online to see new jobs.</div>`; trkSync(); return; }
  let q = sb.from("bookings").select("*").order("created_at", { ascending: false });
  q = jobTab === "open" ? q.eq("status", "searching") : q.eq("rider_id", me.id);
  const { data, error } = await q;
  if (error) { jobSig = ""; $("#rlist").innerHTML = `<div class="empty">${esc(error.message)}</div>`; return; }
  jobData = new Map(data.map(j => [String(j.id), j]));
  const sig = jobTab + "|" + Math.floor(Date.now() / 60000) + "|" + data.map(j => [j.id, j.status, j.rider_id, j.details?.stage].join(":")).join(",");
  if (quiet && sig === jobSig) return;
  jobSig = sig;
  if (!data.length) $("#rlist").innerHTML = `<div class="empty">${jobTab === "open" ? "No open jobs right now. New ones appear here automatically." : "You haven't accepted any jobs yet."}</div>`;
  else if (jobTab === "open") $("#rlist").innerHTML = `<p class="jc-sec">${data.length} open job${data.length > 1 ? "s" : ""} near you</p>` + data.map(jobCard).join("");
  else {
    const a = data.filter(isActive), h = data.filter(j => !isActive(j));
    $("#rlist").innerHTML = (a.length ? `<p class="jc-sec">In progress</p>${a.map(jobCard).join("")}` : "") + (h.length ? `<p class="jc-sec">History</p>${h.map(jobCard).join("")}` : "");
  }
  trkSync();
}

async function jobAdvance(j, s, g) {
  // Rides only move when the rider taps. If the GPS says they are nowhere near the right spot, ask first.
  const geo = j.type === "ride" && TRK.last && (s === "on_the_way" ? j.details?.pickup_geo : s === "done" ? j.details?.dropoff_geo : null);
  if (geo) {
    const m = Math.round(rmDist(TRK.last, geo));
    if (m > 300 && !confirm(`You're about ${m} m from the ${s === "on_the_way" ? "pickup" : "drop-off"}. ${s === "on_the_way" ? "Start the trip" : "Mark it done"} anyway?`)) return;
  }
  const u = { status: s };
  if (j.type === "food" && g) u.details = { ...j.details, stage: g };
  const { error } = await sb.from("bookings").update(u).eq("id", j.id);
  if (error) toast(error.message);
  if (s === "done") statsAt = 0;
  loadJobs();
}

$("#rlist").onclick = async e => {
  const b = e.target.closest("[data-accept],[data-map],[data-id]");
  if (!b) return;
  if (b.dataset.map) { jmOpen(b.dataset.map); return; }
  if (b.dataset.accept) { // only succeeds if nobody else took it first
    b.disabled = true;
    const a = b.dataset.accept, j = jobData.get(a), u = { status: "accepted", rider_id: me.id };
    if (j?.type === "food") u.details = { ...j.details, stage: "to_rest" };
    const { data, error } = await sb.from("bookings").update(u).eq("id", a).eq("status", "searching").select();
    if (error) toast(error.message); else if (!data.length) toast("Too late: another rider already took that job"); else toast("Job accepted");
    loadJobs();
  } else jobAdvance(jobData.get(b.dataset.id), b.dataset.s, b.dataset.g);
};

$("#rnav").onclick = e => {
  const b = e.target.closest("button");
  if (!b) return;
  jobTab = b.dataset.t; jobSig = "";
  document.querySelectorAll("#rnav button").forEach(x => x.classList.toggle("on", x === b));
  $("#rsub").textContent = jobTab === "open" ? "Open jobs near you" : "Your jobs";
  loadJobs();
};
