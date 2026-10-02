// Call / Message / Cancel bar shared by the customer and rider screens.
// "Call" opens the phone's dialer with the number filled in (a web page can't dial without the person's tap); "Message" opens their SMS app.
const telNum = p => { const d = String(p || "").replace(/\D/g, ""); return d.length === 10 ? "+63" + d : d.length === 11 && d[0] === "0" ? "+63" + d.slice(1) : d.length === 12 && d.startsWith("63") ? "+" + d : d.length >= 7 ? d : ""; };
const CT_I = {
  call: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
  msg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>'
};
function ctBar(phone, o = {}) {   // o.cancel: also show a Cancel button (handled by the screen that owns it)
  const n = telNum(phone), b = (k, l, href) => n ? `<a class="ct-b" href="${href}${n}">${CT_I[k]}<span>${l}</span></a>` : `<button type="button" class="ct-b" data-ctno>${CT_I[k]}<span>${l}</span></button>`;
  return `<div class="ct${o.cancel ? "" : " two"}">${b("call", "Call", "tel:")}${b("msg", "Message", "sms:")}${o.cancel ? `<button type="button" class="ct-b ct-x" data-ctcancel>${CT_I.x}<span>Cancel</span></button>` : ""}</div>`;
}
document.addEventListener("click", e => { if (e.target.closest("[data-ctno]")) toast("Their phone number isn't available yet."); });
// Cancel on its own (before a rider has accepted, there is nobody to call yet).
const ctCancel = () => `<div class="ct one"><button type="button" class="ct-b ct-x" data-ctcancel>${CT_I.x}<span>Cancel</span></button></div>`;
const CT_CUST = new Map();   // rider side: booking id -> customer's phone
async function ctCustomerPhone(id) {
  id = String(id); if (CT_CUST.has(id)) return CT_CUST.get(id);
  const { data, error } = await sb.rpc("get_booking_customer", { p_booking_id: id });
  const ph = !error && data && data[0] ? data[0].customer_phone || "" : "";
  if (ph) CT_CUST.set(id, ph);
  return ph;
}
