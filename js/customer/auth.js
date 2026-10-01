// Sign in / create account (one login for customers and riders). Sign out is wired in js/main.js.
let authMode = "in";
function authSet(mode) {
  authMode = mode; const up = mode === "up";
  $("#upf").hidden = !up; $("#tosignin").hidden = !up; $("#signin").hidden = up; $(".or").hidden = up;
  $("#pw").setAttribute("autocomplete", up ? "new-password" : "current-password");
  $("#autherr").textContent = ""; $("#signup").querySelector(".lbl").textContent = up ? "Create my account" : "Create account";
  if (up) $("#fn").focus();
}
async function auth(kind) {
  const err = t => { $("#autherr").textContent = t; UI.shake(); };
  $("#autherr").textContent = "";
  const email = $("#em").value.trim(), password = $("#pw").value;
  if (kind === "up") {
    const name = $("#fn").value.trim(), phone = $("#ph").value.replace(/[^\d+]/g, "");
    if (!name) return err("Please enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return err("Please enter a valid email.");
    if (password.length < 6) return err("Password must be at least 6 characters.");
    if (password !== $("#pw2").value) return err("The two passwords don't match.");
    if (phone && phone.length < 7) return err("That mobile number looks too short.");
    var cred = { email, password, options: { data: { full_name: name, phone } } };
  } else cred = { email, password };
  const btn = $(kind === "up" ? "#signup" : "#signin");
  UI.busy(btn, true); UI.begin(btn, kind, kind === "up" ? "Creating your account…" : "Preparing your Biyahe…");
  const { data, error } = kind === "up" ? await sb.auth.signUp(cred) : await sb.auth.signInWithPassword(cred);
  UI.busy(btn, false);
  if (error) { UI.end(); return err(error.message); }
  if (kind === "up" && data.user && data.user.identities && !data.user.identities.length) { UI.end(); return err("That email is already registered. Please sign in."); }
  if (kind === "up" && !data.session) { UI.end(); authSet("in"); $("#autherr").textContent = "Account created. Check your email to confirm, then sign in."; }
}
$("#signin").onclick = () => auth("in");
$("#signup").onclick = () => authMode === "up" ? auth("up") : authSet("up");
$("#tosignin").onclick = () => authSet("in");
