// Deliver tab: package sizes and booking.
function renderSizes() {
  $("#sizes").innerHTML = SIZES.map((s, i) => `<button class="opt ${st.size === i ? "sel" : ""}" data-i="${i}"><span><b>${s.n}</b><small>${s.d}</small></span><span class="price">${peso(s.p)}</span></button>`).join("");
  $("#dbook").disabled = !($("#di").value.trim() && $("#dp").value.trim() && $("#dd").value.trim() && st.size !== null);
}

$("#sizes").onclick = e => {
  const b = e.target.closest(".opt");
  if (b) { st.size = +b.dataset.i; renderSizes(); }
};
["#di", "#dp", "#dd"].forEach(s => $(s).oninput = renderSizes);

$("#dbook").onclick = async () => {
  const s = SIZES[st.size];
  if (await book("delivery", $("#dp").value, $("#dd").value, { item: $("#di").value, size: s.n, summary: `${$("#di").value} to ${$("#dd").value}` }, s.p)) {
    ["#di", "#dp", "#dd"].forEach(x => $(x).value = ""); st.size = null; renderSizes();
  }
};
