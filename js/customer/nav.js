// Bottom tab bar.
$("#cnav").onclick = e => {
  const b = e.target.closest("button");
  if (!b) return;
  document.querySelectorAll("#cnav button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll("section").forEach(s => s.classList.toggle("on", s.id === b.dataset.t));
  $("#app main").classList.toggle("fit", b.dataset.t === "ride");   // the map screen never scrolls
  $("#sub").textContent = SUB[b.dataset.t];
};
