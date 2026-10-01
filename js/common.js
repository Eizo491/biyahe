// Helpers and the Supabase client shared by the customer app and the rider app.
const $ = s => document.querySelector(s);
const peso = n => "₱" + Number(n).toFixed(0);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Opened from the confirmation email? (must be read before supabase-js clears the #hash)
const CONFIRMED = /type=(signup|email)/.test(location.hash);
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function toast(t) {
  const x = $("#toast");
  x.textContent = t;
  x.classList.add("show");
  setTimeout(() => x.classList.remove("show"), 2400);
}

// Current accent color (changes with the Theme picker). Used for map routes.
const accent = () => getComputedStyle(document.documentElement).getPropertyValue("--pri").trim() || "#1f4fd8";
