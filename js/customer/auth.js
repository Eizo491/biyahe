// Sign in / create account. Sign in with email OR mobile number; sign-up needs a strong password.
let authMode = "in";
const PW_COMMON = ["password", "12345678", "qwerty", "iloveyou", "biyahe", "admin123", "123456789", "abc12345"];
const normPhone = v => { let d = String(v || "").replace(/\D/g, ""); if (d.startsWith("63") && d.length === 12) d = d.slice(2); else if (d.startsWith("0") && d.length === 11) d = d.slice(1); return d.length === 10 && d[0] === "9" ? "+63" + d : null; };
function pwCheck(p, email, phone) {
  const r = { len: p.length >= 8, lo: /[a-z]/.test(p), up: /[A-Z]/.test(p), num: /\d/.test(p), sym: /[^A-Za-z0-9]/.test(p) };
  const low = p.toLowerCase(), local = (email || "").split("@")[0].toLowerCase(), dig = String(phone || "").replace(/\D/g, "").slice(-10);
  const weak = PW_COMMON.some(w => low.includes(w)) || (local.length >= 4 && low.includes(local)) || (dig.length >= 7 && p.includes(dig.slice(-7))) || /^(.)\1+$/.test(p);
  const n = Object.values(r).filter(Boolean).length + (p.length >= 12 ? 1 : 0) - (weak ? 2 : 0);
  const sc = Math.max(0, Math.min(r.len ? 5 : 2, n));
  return { r, weak, ok: Object.values(r).every(Boolean) && !weak, score: sc };
}
const fieldErr = (id, msg) => {   // red border + shake + message under the field
  const f = $(`.f[data-f="${id}"]`), box = f.querySelector(".fld");
  f.classList.add("bad"); $(`#${id}-e`).textContent = msg;
  box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");
  $(`#${id}`).setAttribute("aria-invalid", "true");
};
const fieldOk = id => { const f = $(`.f[data-f="${id}"]`); f.classList.remove("bad"); $(`#${id}-e`).textContent = ""; $(`#${id}`).removeAttribute("aria-invalid"); };
const formMsg = (t, good) => { const e = $("#autherr"); e.textContent = t; e.classList.toggle("good", !!good); };
const friendly = m => /invalid login/i.test(m) ? "Wrong email/number or password. Please try again."
  : /not confirmed/i.test(m) ? "Please confirm your email first. Check your inbox." : /already registered/i.test(m) ? "That email is already registered. Please sign in."
  : /rate limit|too many|seconds/i.test(m) ? "Too many tries. Please wait a minute and try again." : /fetch|network/i.test(m) ? "No internet connection. Check your Wi-Fi or data."
  : /weak|password/i.test(m) ? "That password is too weak. Follow the checklist." : m;

function pwLive() {
  const p = $("#pw").value, c = pwCheck(p, $("#em").value, $("#ph").value), box = $(".pwhelp");
  for (const k in c.r) box.querySelector(`[data-r="${k}"]`).classList.toggle("ok", c.r[k]);
  const lv = !p ? 0 : c.score <= 2 ? 1 : c.score <= 4 ? 2 : 3, names = ["Use a strong password", "Weak", "Okay, keep going", "Strong"];
  box.dataset.lv = lv; box.querySelector(".mlabel").textContent = c.weak && p ? "Too easy to guess" : names[lv];
  return c;
}
function authSet(mode) {
  authMode = mode; const up = mode === "up";
  document.querySelectorAll("#auth [data-m]").forEach(e => { e.hidden = e.dataset.m !== mode; });
  $("#tabin").classList.toggle("on", !up); $("#tabup").classList.toggle("on", up);
  $("#pw").setAttribute("autocomplete", up ? "new-password" : "current-password");
  $("#pw").placeholder = up ? "Create a strong password" : "Your password";
  document.querySelectorAll("#auth .f").forEach(f => fieldOk(f.dataset.f)); formMsg("");
  $("#auth .sub").textContent = up ? "Create your free account to book rides, order food and send packages." : "Sign in to book rides, order food, send packages or pick up jobs as a rider.";
  $("#auth").classList.toggle("upm", up);
  if (up) { pwLive(); upShow(1, 1, false); } else { $('.f[data-f="pw"]').hidden = false; $("#gor").hidden = $("#google").hidden = false; }
}

// ---------- Create account: one question per screen (name → mobile → email → password), like Google's sign-up ----------
const UPSTEP = { fn: 1, ph: 2, em: 3, pw: 4, pw2: 4 }, UPN = 4;
const UPTXT = [["What's your name?", "Enter your full name so riders know who they're picking up."], ["Your mobile number", "Riders may call or text you about your trip."],
  ["Add your email", "We'll send a link to confirm it, and use it for receipts."], ["Create a password", "Pick a strong one that you don't use anywhere else."]];
let upN = 1;
function upShow(n, dir = 1, focus = false) {
  upN = n;
  document.querySelectorAll("#auth .f").forEach(f => { f.hidden = UPSTEP[f.dataset.f] !== n; });
  $(".pwhelp").hidden = n !== 4;
  $("#signup").hidden = n !== UPN; $("#upnext").hidden = n === UPN; $("#upback").hidden = n === 1;
  $("#upn").textContent = `Step ${n} of ${UPN}`;
  document.querySelectorAll(".stp-bar i").forEach((b, i) => b.classList.toggle("on", i < n));
  $("#uph").textContent = UPTXT[n - 1][0]; $("#upp").textContent = UPTXT[n - 1][1];
  const box = $("#auth .fields"); box.dataset.dir = dir > 0 ? "f" : "b"; box.classList.remove("stin"); void box.offsetWidth; box.classList.add("stin");
  $("#gor").hidden = $("#google").hidden = n !== 1;   // Google button only on the first screen
  if (focus) { const i = document.querySelector("#auth .f:not([hidden]) input"); if (i) i.focus(); }
}
async function upNext() {
  if (upN === UPN) return auth("up");
  formMsg(""); document.querySelectorAll("#auth .f").forEach(f => fieldOk(f.dataset.f));
  let bad = false; const e = (id, m) => { fieldErr(id, m); $(`#${id}`).focus(); bad = true; };
  if (upN === 1 && $("#fn").value.trim().length < 2) e("fn", "Please enter your full name.");
  if (upN === 2) {
    const phone = normPhone($("#ph").value);
    if (!phone) e("ph", "Enter a valid mobile number, like 9xx xxx xxxx.");
    else {   // catch a number that's already registered now, not after four screens
      const btn = $("#upnext"); UI.busy(btn, true);
      const { data: free, error } = await sb.rpc("phone_available", { p_phone: phone });
      UI.busy(btn, false);
      if (!error && free === false) e("ph", "That mobile number is already registered.");
    }
  }
  if (upN === 3 && !/^\S+@\S+\.\S+$/.test($("#em").value.trim())) e("em", "Enter a valid email, like you@email.com.");
  if (!bad) upShow(upN + 1, 1, true);
}
$("#upnext").onclick = upNext;
$("#upback").onclick = () => { formMsg(""); upShow(upN - 1, -1, true); };

async function auth(kind) {
  formMsg(""); document.querySelectorAll("#auth .f").forEach(f => fieldOk(f.dataset.f));
  let bad = false; const e = (id, m) => { if (!bad) { if (authMode === "up") upShow(UPSTEP[id] || upN); $(`#${id}`).focus(); } fieldErr(id, m); bad = true; };
  let cred;
  if (kind === "up") {
    const name = $("#fn").value.trim(), phone = normPhone($("#ph").value), email = $("#em").value.trim(), pw = $("#pw").value, c = pwCheck(pw, email, $("#ph").value);
    if (name.length < 2) e("fn", "Please enter your full name.");
    if (!phone) e("ph", "Enter a valid mobile number, like 9xx xxx xxxx.");
    if (!/^\S+@\S+\.\S+$/.test(email)) e("em", "Enter a valid email, like you@email.com.");
    if (!pw) e("pw", "Please create a password."); else if (!c.ok) e("pw", c.weak ? "That password is too easy to guess." : "Password isn't strong enough yet.");
    if ($("#pw2").value !== pw || !$("#pw2").value) e("pw2", "The two passwords don't match.");
    if (bad) return;
    const btn = $("#signup"); UI.busy(btn, true);
    const { data: free, error: fe } = await sb.rpc("phone_available", { p_phone: phone });
    if (!fe && free === false) { UI.busy(btn, false); return e("ph", "That mobile number is already registered."); }
    cred = { email, password: pw, options: { data: { full_name: name, phone } } };
    UI.begin(btn, "up", "Creating your account…");
    const { data, error } = await sb.auth.signUp(cred);
    UI.busy(btn, false);
    if (error) { UI.end(); if (/already registered/i.test(error.message)) return e("em", "That email is already registered. Please sign in."); return formMsg(friendly(error.message)); }
    if (data.user && data.user.identities && !data.user.identities.length) { UI.end(); return e("em", "That email is already registered. Please sign in."); }
    if (!data.session) { UI.end(); authSet("in"); $("#lid").value = email; formMsg("Account created! Check your email to confirm, then sign in.", true); }
    return;
  }
  const id = $("#lid").value.trim(), pw = $("#pw").value;
  if (!id) e("lid", "Enter your email or mobile number."); if (!pw) e("pw", "Enter your password.");
  let phone = null;
  if (id && !id.includes("@")) { phone = normPhone(id); if (!phone) e("lid", "That doesn't look like an email or a mobile number."); }
  else if (id && !/^\S+@\S+\.\S+$/.test(id)) e("lid", "Enter a valid email, like you@email.com.");
  if (bad) return;
  const btn = $("#signin"); UI.busy(btn, true); UI.begin(btn, "in", "Preparing your Biyahe…");
  let email = id;
  if (phone) { const { data } = await sb.rpc("login_email_for_phone", { p_phone: phone }); email = data || ""; }
  const { error } = email ? await sb.auth.signInWithPassword({ email, password: pw }) : { error: { message: "Invalid login credentials" } };
  UI.busy(btn, false);
  if (error) { UI.end(); fieldErr("pw", friendly(error.message).replace(/ Please try again\.$/, "")); $("#pw").focus(); formMsg(/network|fetch/i.test(error.message) ? friendly(error.message) : ""); }
}

$("#signin").onclick = () => auth(authMode === "up" ? "up" : "in");
$("#signup").onclick = () => auth("up");
$("#tabin").onclick = () => authSet("in");
$("#tabup").onclick = () => authSet("up");
document.querySelectorAll("#auth .f input").forEach(i => {
  i.addEventListener("input", () => { fieldOk(i.id); if (i.id === "pw" || i.id === "em" || i.id === "ph") if (authMode === "up") pwLive(); });
  i.addEventListener("keydown", ev => {
    if (ev.key !== "Enter") return;
    if (authMode === "up") { ev.preventDefault(); return i.id === "pw" ? $("#pw2").focus() : upNext(); }
    if (i.id !== "pw") auth("in");
  });
});
authSet("in");

// ---------- Continue with Google ----------
// Supabase: Authentication > Providers > Google (enable it) and add this page's address under Authentication > URL Configuration > Redirect URLs.
$("#google").onclick = async () => {
  const b = $("#google"); formMsg(""); UI.busy(b, true);
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
  if (error) { UI.busy(b, false); formMsg(/not enabled|unsupported provider/i.test(error.message) ? "Google sign-in isn't set up yet. Turn on the Google provider in Supabase." : friendly(error.message)); }
};

// ---------- Google accounts have no phone number yet: ask for it before the app opens ----------
const needPhone = async u => { const { data, error } = await sb.from("profiles").select("phone").eq("id", u.id).maybeSingle(); return !error && !(data && normPhone(data.phone)); };
let phGateP = null;
function phoneGate(user) {
  if (phGateP) return phGateP;
  return phGateP = new Promise(resolve => {
    const nm = String(user.user_metadata?.full_name || user.user_metadata?.name || "").split(" ")[0], o = document.createElement("div");
    o.id = "phgate"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
    o.innerHTML = `<div class="phc"><h2>${nm ? "Almost there, " + esc(nm) : "One last step"}</h2><p>Add your mobile number so your rider can reach you. You need it before you can book.</p>
      <div class="f" data-f="gph"><label for="gph">Mobile number</label><div class="fld"><span class="pre">+63</span><input id="gph" type="tel" inputmode="tel" autocomplete="tel" placeholder="9xx xxx xxxx" aria-describedby="gph-e"></div><small class="ferr" id="gph-e" role="alert"></small></div>
      <button class="cta" id="gok" type="button"><span class="lbl">Continue</span></button><button class="cta alt" id="gout" type="button">Use a different account</button></div>`;
    document.body.appendChild(o);
    const inp = o.querySelector("#gph"), ok = o.querySelector("#gok"), end = () => { o.remove(); phGateP = null; };
    const go = async () => {
      fieldOk("gph");
      const phone = normPhone(inp.value);
      if (!phone) { fieldErr("gph", "Enter a valid mobile number, like 9xx xxx xxxx."); return inp.focus(); }
      UI.busy(ok, true);
      const { data: free } = await sb.rpc("phone_available", { p_phone: phone });
      if (free === false) { UI.busy(ok, false); fieldErr("gph", "That mobile number is already registered."); return inp.focus(); }
      const { error } = await sb.rpc("set_my_phone", { p_phone: phone });
      UI.busy(ok, false);
      if (error) return fieldErr("gph", /already registered/i.test(error.message) ? "That mobile number is already registered." : "Couldn't save it. Run supabase/contact.sql, then try again.");
      end(); resolve();
    };
    ok.onclick = go; inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); }); inp.addEventListener("input", () => fieldOk("gph"));
    o.querySelector("#gout").onclick = () => { end(); sb.auth.signOut(); };
    setTimeout(() => inp.focus(), 50);
  });
}
