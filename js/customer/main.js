// Customer dashboard start/stop. The login and the customer/rider routing live in js/main.js.
function startCustomer(user) {
  if (user) Drawer.setup(user, "customer");
  ntStart(user, "customer"); loadRests(); loadActs(); listen(); checkApplication(); rideStart(); ciStart();
}

function stopCustomer() {
  rideStop(); ciStop(); closeTrack(); closeStore(); closeCko(); st.cart = {}; ntStop(); Drawer.close(true);
  if (st.chan) { sb.removeChannel(st.chan); st.chan = null; }
  $("#acts").innerHTML = "";
  closeApply();
  const b = $("#become");
  b.lastElementChild.textContent = "Become a rider"; b.disabled = false;
}

renderVeh();
renderSizes();
renderApplyVeh();
