// Side menu for customers and riders: profile, quick links, feedback and sign out.
// Drawer.setup(user, role) is called when a customer or rider dashboard starts; Drawer.close() when it stops.
window.Drawer = (() => {
  const el = $("#drawer");
  let cur = null, isOpen = false, seq = 0, opener = null;

  const nameOf = (u, pf) => {
    const m = u?.user_metadata || {};
    const n = pf?.full_name || m.full_name || m.name || (u?.email || "").split("@")[0];
    return n.replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim() || "Your profile";
  };
  const initials = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
  const row = (k, v) => v ? `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>` : "";

  function paint(user, role, pf, extra) {
    const name = nameOf(user, pf), rider = role === "rider";
    $("#drname").textContent = name;
    $("#dremail").textContent = user.email || "";
    $("#drav").textContent = initials(name);
    document.querySelectorAll(".avbtn").forEach(b => { b.textContent = initials(name); b.title = name; });
    const tag = $("#drrole"); tag.textContent = rider ? "Rider" : "Customer"; tag.classList.toggle("ok", rider);
    $("#drl1").textContent = rider ? "Jobs done" : "Bookings";
    $("#drl2").textContent = rider ? "Rating" : "Completed";
    $("#drs1").textContent = extra.s1 ?? "–";
    $("#drs2").textContent = extra.s2 ?? "–";
    const since = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "";
    $("#drinfo").innerHTML = row("Mobile", pf?.phone) + (rider ? row("Vehicle", extra.vehicle) + row("Plate", extra.plate) : "") + row("Member since", since);
  }

  // Shows what we already know right away, then fills in the rest from Supabase.
  async function load() {
    if (!cur) return;
    const my = ++seq, { user, role } = cur, rider = role === "rider";
    paint(user, role, null, {});
    const { data: pf } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    let extra = {};
    if (rider) {
      const [app, done, rv] = await Promise.all([
        sb.from("rider_applications").select("vehicle, plate").maybeSingle(),
        sb.from("bookings").select("id", { count: "exact", head: true }).eq("rider_id", user.id).eq("status", "done"),
        sb.from("rider_reviews").select("rating")
      ]);
      const r = rv.data || [];
      window.myVeh = app.data?.vehicle;
      extra = { vehicle: app.data?.vehicle, plate: app.data?.plate, s1: done.error ? "–" : done.count ?? 0,
        s2: r.length ? "★ " + (r.reduce((a, x) => a + x.rating, 0) / r.length).toFixed(1) : "–" };
    } else {
      const [all, done] = await Promise.all([
        sb.from("bookings").select("id", { count: "exact", head: true }),
        sb.from("bookings").select("id", { count: "exact", head: true }).eq("status", "done")
      ]);
      extra = { s1: all.error ? "–" : all.count ?? 0, s2: done.error ? "–" : done.count ?? 0 };
    }
    if (my === seq && cur) paint(user, role, pf, extra);
  }

  function setup(user, role) {
    cur = { user, role };
    el.dataset.role = role;
    load();
  }

  function mark() {   // highlight the screen the person is on
    const rider = cur?.role === "rider", tab = rider ? (typeof jobTab !== "undefined" ? jobTab : "open") : $("#cnav .on")?.dataset.t;
    el.querySelectorAll(rider ? "[data-rgo]" : "[data-go]").forEach(b => b.classList.toggle("on", (b.dataset.rgo || b.dataset.go) === tab));
  }

  function open() {
    if (isOpen || !cur) return;
    isOpen = true; opener = document.activeElement;
    mark(); load();
    el.classList.remove("leave"); el.classList.add("open");
    setTimeout(() => $("#drclose").focus(), 60);
  }
  function close(instant) {
    if (!isOpen) return;
    isOpen = false;
    if (instant) { el.classList.remove("open", "leave"); return; }
    el.classList.add("leave");
    setTimeout(() => { if (!isOpen) el.classList.remove("open", "leave"); }, 250);
    if (opener && opener.focus) opener.focus();
  }

  document.querySelectorAll("[data-menu]").forEach(b => b.addEventListener("click", open));
  $("#drclose").onclick = () => close();
  $("#drbg").onclick = () => close();
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  el.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b || b.id === "drclose" || b.id === "dout") return;
    if (b.dataset.go) document.querySelector(`#cnav [data-t="${b.dataset.go}"]`).click();
    else if (b.dataset.rgo) document.querySelector(`#rnav [data-t="${b.dataset.rgo}"]`).click();
    if (!b.disabled) close();   // "Become a rider" and "Send feedback" open their own sheets
  });
  return { setup, open, close };
})();
