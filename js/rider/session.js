// Starting and stopping the rider dashboard. Sign-in lives in the shared login (see js/main.js).
function startRider(user) {
  me = user; ntStart(user, "rider");
  Drawer.setup(user, "rider");
  loadJobs();
  goOnline(user);
  if (!jobChan) jobChan = sb.channel("jobs").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => loadJobs()).subscribe();
  // Live updates can miss a job another rider just took (the database hides rows you can't see from the live feed), so the
  // list also re-checks every 5 s and whenever the app comes back on screen. A taken job loses its Accept button within seconds.
  if (!jobPoll) jobPoll = setInterval(() => { if (document.visibilityState === "visible") loadJobs(true); }, 5000);
}

let presChan = null, beat = null;
// Tells the owner console this rider is online (Realtime presence) and stamps "last seen" once a minute.
function goOnline(user) {
  if (presChan) return;
  presChan = sb.channel("riders-online", { config: { presence: { key: user.id } } });
  presChan.subscribe(st => { if (st === "SUBSCRIBED") presChan.track({ at: Date.now() }); });
  sb.rpc("rider_heartbeat");
  beat = setInterval(() => sb.rpc("rider_heartbeat"), 60000);
}

function stopRider() {
  Drawer.close(true); trkStop(); jmClose(); ntStop(); rOnline = true; statsAt = 0; $("#rdash").innerHTML = "";
  if (beat) { clearInterval(beat); beat = null; }
  if (presChan) { sb.removeChannel(presChan); presChan = null; }
  me = null;
  jobTab = "open"; // next rider to sign in starts on Open jobs
  document.querySelectorAll("#rnav button").forEach(b => b.classList.toggle("on", b.dataset.t === "open"));
  $("#rsub").textContent = "Open bookings near you";
  if (jobChan) { sb.removeChannel(jobChan); jobChan = null; }
  if (jobPoll) { clearInterval(jobPoll); jobPoll = null; }
  jobSig = "";
  $("#rlist").innerHTML = "";
}

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && me) loadJobs(true); });
