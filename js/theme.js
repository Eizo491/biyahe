// Theme: mode (Light / Dark / Auto) + accent color. Light + blue is the default. Saved on this device.
// The first paint is handled by the tiny script in <head> of index.html; this file runs the Theme sheet.
window.Theme = (() => {
  const MODE = "biyahe-theme", ACC = "biyahe-accent", mq = matchMedia("(prefers-color-scheme:dark)"), root = document.documentElement;
  const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode: lasts for this visit only */ } };
  function apply() {
    const mode = get(MODE, "light"), ac = get(ACC, "blue"), dark = mode === "dark" || (mode === "auto" && mq.matches);
    root.dataset.theme = dark ? "dark" : "light"; root.dataset.accent = ac;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = dark ? "#0f151d" : getComputedStyle(root).getPropertyValue("--pri").trim();
    document.querySelectorAll("#cnav img").forEach(i => { i.src = i.getAttribute("src").replace(/(-dark)?\.png$/, dark ? "-dark.png" : ".png"); });   // tab icons
    document.querySelectorAll("#themeseg button").forEach(b => b.classList.toggle("on", b.dataset.th === mode));
    document.querySelectorAll("#accseg button").forEach(b => b.classList.toggle("on", b.dataset.ac === ac));
    document.dispatchEvent(new Event("themechange"));
    const cur = document.getElementById("themecur"); if (cur) cur.textContent = ({ light: "Light", dark: "Dark", auto: "Auto" })[mode] + " · " + ac[0].toUpperCase() + ac.slice(1);
  }

  const sheet = document.getElementById("themesheet");
  const open = () => { if (window.Drawer) Drawer.close(); sheet.classList.remove("leave"); sheet.classList.add("open"); };
  const close = () => { if (!sheet.classList.contains("open")) return; sheet.classList.add("leave"); setTimeout(() => sheet.classList.remove("open", "leave"), 250); };
  document.querySelectorAll("[data-theme-open]").forEach(b => b.addEventListener("click", open));
  document.getElementById("thdone").onclick = close;
  sheet.onclick = e => { if (e.target === sheet) close(); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  document.getElementById("themeseg").onclick = e => { const b = e.target.closest("[data-th]"); if (b) { put(MODE, b.dataset.th); apply(); } };
  document.getElementById("accseg").onclick = e => { const b = e.target.closest("[data-ac]"); if (b) { put(ACC, b.dataset.ac); apply(); } };
  mq.addEventListener("change", () => { if (get(MODE, "light") === "auto") apply(); });
  apply();
  return { open, close };
})();
