// Startup for the single Biyahe page. Keep this file LAST in index.html.
// One login for everyone: after sign-in the account's role picks the dashboard.
//   profiles.role = "admin"  -> owner dashboard (#aapp)
//   profiles.role = "rider"  -> rider dashboard (#rapp)
//   anything else            -> customer dashboard (#app)
async function roleOf(user) {
  const { data, error } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return !error && (data?.role === "admin" || data?.role === "rider") ? data.role : "customer";
}

let routeSeq = 0; // ignore stale results if the auth state changes while the role is loading
async function route(session) {
  const seq = ++routeSeq;
  if (!session) { stopCustomer(); stopRider(); stopAdmin(); UI.show(false); return; }
  const role = await roleOf(session.user);
  if (typeof CONFIRMED !== "undefined" && CONFIRMED && !route.done) { route.done = true; setTimeout(() => toast("Email confirmed! Welcome to Biyahe."), 600); }
  if (role !== "admin" && typeof needPhone === "function" && await needPhone(session.user)) await phoneGate(session.user);   // Google sign-in: phone number first
  if (seq !== routeSeq) return;
  if (role === "admin") {
    stopCustomer(); stopRider(); startAdmin(session.user);
    UI.show(true, session.user, "#aapp", "Loading applications…");
  } else if (role === "rider") {
    stopCustomer(); stopAdmin(); startRider(session.user);
    UI.show(true, session.user, "#rapp", "Loading open bookings…");
  } else {
    stopRider(); stopAdmin(); startCustomer(session.user);
    UI.show(true, session.user, "#app");
  }
}

// Deferred with setTimeout: supabase-js can deadlock if this callback awaits other supabase calls directly.
sb.auth.onAuthStateChange((_e, session) => { setTimeout(() => route(session), 0); });
sb.auth.getSession().then(({ data }) => { if (!data.session) route(null); });

const signOut = () => UI.signOut(() => pushOff(false).then(() => sb.auth.signOut()));
$("#dout").onclick = () => { Drawer.close(true); signOut(); };
$("#aout").onclick = () => {
  const b = $("#aout");
  b.classList.add("busy"); b.querySelector("span").textContent = "Signing out…";
  signOut();
};
