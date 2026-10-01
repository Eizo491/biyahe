// "Become a rider": a short application. The role change itself happens on the server
// (the apply_as_rider function in supabase/rider-apply.sql), never from the browser.
let apVeh = null;

function renderApplyVeh() {
  $("#apveh").innerHTML = VEH.map((v, i) => `<button type="button" class="opt vp ${apVeh === i ? "sel" : ""}" data-i="${i}" aria-pressed="${apVeh === i}"><span class="vo-i">${vhSvg(v.n)}</span><b>${v.n}</b></button>`).join("");
}
$("#apveh").onclick = e => {
  const b = e.target.closest(".opt");
  if (b) { apVeh = +b.dataset.i; renderApplyVeh(); }
};

function openApply() {
  $("#aperr").textContent = "";
  $("#apply").classList.remove("leave");
  $("#apply").classList.add("open");
  setTimeout(() => $("#apname").focus(), 50);
}

function closeApply() {
  const a = $("#apply");
  if (!a.classList.contains("open")) return;
  a.classList.add("leave");
  setTimeout(() => { a.classList.remove("open", "leave"); }, 250);
}

["#apname", "#apphone", "#applate"].forEach(s => $(s).oninput = () => { $("#aperr").textContent = ""; });
$("#apveh").addEventListener("click", () => { $("#aperr").textContent = ""; });

$("#become").onclick = openApply;
$("#apcancel").onclick = closeApply;
$("#apply").onclick = e => { if (e.target.id === "apply") closeApply(); };
document.addEventListener("keydown", e => { if (e.key === "Escape") closeApply(); });

function markPending() {
  const b = $("#become");
  b.lastElementChild.textContent = "Application pending"; b.disabled = true;
}

// If an application is already waiting for review, say so on the button.
async function checkApplication() {
  const { data } = await sb.from("rider_applications").select("status").maybeSingle();
  if (data?.status === "pending") markPending();
  else if (data?.status === "rejected") { const b = $("#become"); b.lastElementChild.textContent = "Application not approved"; b.disabled = true; }
}

$("#apsubmit").onclick = async () => {
  const err = m => { $("#aperr").textContent = m; };
  const name = $("#apname").value.trim(), phone = $("#apphone").value.trim(), plate = $("#applate").value.trim();
  $("#aperr").textContent = "";
  if (name.length < 2) return err("Please enter your full name.");
  if (!/^\+?[\d\s-]{10,}$/.test(phone)) return err("Please enter a valid mobile number.");
  if (apVeh === null) return err("Please choose your vehicle.");
  if (plate.length < 3) return err("Please enter your plate number.");

  const btn = $("#apsubmit");
  UI.busy(btn, true);
  const { data: role, error } = await sb.rpc("apply_as_rider", { p_name: name, p_phone: phone, p_vehicle: VEH[apVeh].n, p_plate: plate });
  UI.busy(btn, false);
  if (error) return err(error.message);

  const { data: { session } } = await sb.auth.getSession(); // local, no network round trip
  const user = session?.user;
  closeApply();
  if (role === "rider") {          // approved on the spot: switch dashboards
    stopCustomer();
    startRider(user);
    UI.promote(user, "#rapp");
  } else {                         // waiting for review
    markPending();
    toast("Application sent. We'll let you know once it's reviewed.");
  }
};
