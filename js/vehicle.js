// Vehicle markers for every map: a top-down Motorcycle / Tricycle / Car that turns to face where it is heading,
// plus helpers to drive a vehicle along a road route. Needs Leaflet (L) and rmDist() from customer/map.js at call time.
const VH_COL = { Motorcycle: "#ffc93c", Tricycle: "#ff9a5c", Car: "#1f4fd8" };
const VH_DK = "#1a2650";

function vhSvg(kind, o = {}) {
  const c = VH_COL[kind] || VH_COL.Motorcycle, lt = `style="fill:color-mix(in srgb,${c} 68%,#fff)"`;
  const moto = (box, dx) => `<g transform="translate(${dx} 0)"><rect x="-2.5" y="-30" width="5" height="12" rx="2.5" fill="${VH_DK}"/><rect x="-3" y="14" width="6" height="15" rx="3" fill="${VH_DK}"/>` +
    `<rect x="-6.5" y="-19" width="13" height="36" rx="6" fill="${c}" stroke="#fff" stroke-width="1.4"/>` +
    (box ? `<rect x="-8" y="6" width="16" height="16" rx="3" fill="#ffc93c" stroke="#d99a00"/><path d="M-8 14H8" stroke="#d99a00"/>` : "") +
    `<rect x="-13" y="-17" width="26" height="3.4" rx="1.7" fill="${VH_DK}"/><path d="M-8-8L-11-15M8-8L11-15" stroke="#1f4fd8" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cy="-6" rx="9" ry="5.6" fill="#1f4fd8" stroke="#fff" stroke-width=".8"/><circle cy="-5" r="5.2" fill="#16204a"/><circle cx="-1.6" cy="-6.6" r="1.6" fill="#fff" opacity=".6"/></g>`;
  let g;
  if (kind === "Car") {
    g = `<ellipse cx="1.5" cy="3" rx="14" ry="29" fill="#0b1633" opacity=".22"/><g fill="${VH_DK}"><rect x="-14" y="-19" width="4" height="10" rx="2"/><rect x="10" y="-19" width="4" height="10" rx="2"/><rect x="-14" y="12" width="4" height="10" rx="2"/><rect x="10" y="12" width="4" height="10" rx="2"/></g>` +
      `<rect x="-11" y="-27" width="22" height="54" rx="10" fill="${c}" stroke="#fff" stroke-width="1.5"/><rect x="-13.5" y="-11" width="3" height="4.5" rx="1.4" fill="${c}"/><rect x="10.5" y="-11" width="3" height="4.5" rx="1.4" fill="${c}"/>` +
      `<path d="M-8-13Q0-17 8-13L7-6H-7z" fill="#cfe0ff"/><rect x="-8" y="-5" width="16" height="17" rx="4" ${lt}/><path d="M-7 14H7L8 19Q0 21-8 19z" fill="#cfe0ff"/>` +
      `<rect x="-9" y="-27" width="5" height="3" rx="1.5" fill="#fff6c4"/><rect x="4" y="-27" width="5" height="3" rx="1.5" fill="#fff6c4"/><rect x="-9" y="24" width="5" height="2.5" rx="1.2" fill="#ff5c5c"/><rect x="4" y="24" width="5" height="2.5" rx="1.2" fill="#ff5c5c"/>`;
  } else if (kind === "Tricycle") {
    g = `<ellipse cx="0" cy="3" rx="19" ry="28" fill="#0b1633" opacity=".22"/><rect x="6" y="18" width="4.5" height="10" rx="2.2" fill="${VH_DK}"/><rect x="-1" y="6" width="6" height="2.4" fill="${VH_DK}"/><rect x="-1" y="16" width="6" height="2.4" fill="${VH_DK}"/>` +
      `<rect x="3.5" y="-6" width="15" height="31" rx="7" fill="${c}" stroke="#fff" stroke-width="1.4"/><rect x="6" y="-2" width="10" height="21" rx="4.5" ${lt}/>` + moto(false, -7);
  } else g = `<ellipse cx="1.5" cy="3" rx="10" ry="28" fill="#0b1633" opacity=".22"/>` + moto(o.box, 0);
  return `<svg viewBox="-20 -32 40 64" aria-hidden="true">${g}</svg>`;
}

// A Leaflet icon. Toggle .hot / .pick on marker.getElement().firstChild for the highlight ring.
function vhIcon(kind, o = {}) {
  return L.divIcon({ className: o.glide ? "rm-glide" : "", html: `<div class="vh ${kind} ${o.hot ? "hot" : ""}"><div class="vh-rot">${vhSvg(kind, o)}</div></div>`, iconSize: [30, 48], iconAnchor: [15, 24] });
}
const vhBrg = (a, b) => {   // compass bearing in degrees from a to b ({lat,lng} each): 0 = north, 90 = east
  const t = Math.PI / 180, dl = (b.lng - a.lng) * t, y = Math.sin(dl) * Math.cos(b.lat * t),
    x = Math.cos(a.lat * t) * Math.sin(b.lat * t) - Math.sin(a.lat * t) * Math.cos(b.lat * t) * Math.cos(dl);
  return Math.atan2(y, x) / t;
};
function vhAim(m, deg) {   // turn the vehicle (always the short way round)
  const el = m.getElement && m.getElement(); if (!el) return;
  const rot = m._rot || (m._rot = el.querySelector(".vh-rot")); if (!rot) return;
  let cur = m._brg == null ? deg : m._brg;
  cur += ((deg - cur + 540) % 360) - 180;
  m._brg = cur; rot.style.transform = `rotate(${cur.toFixed(1)}deg)`;
}
function vhPlace(m, ll) {   // move to a new GPS point and face the direction of travel
  const p = m.getLatLng(), n = L.latLng(ll);
  if (p.distanceTo(n) > 2) vhAim(m, vhBrg(p, n));
  m.setLatLng(n);
}

// ---- driving along a road route ----
function vhPath(pts) {   // [[lat,lng],...] -> path with running distances (metres)
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + rmDist({ lat: pts[i - 1][0], lng: pts[i - 1][1] }, { lat: pts[i][0], lng: pts[i][1] });
  return { pts, cum, len: cum[cum.length - 1] || 1 };
}
function vhAt(p, s) {   // position + heading after driving s metres along the path
  s = Math.max(0, Math.min(p.len, s));
  let i = 1; while (i < p.pts.length - 1 && p.cum[i] < s) i++;
  const a = p.pts[i - 1], b = p.pts[i], seg = p.cum[i] - p.cum[i - 1] || 1, t = Math.max(0, Math.min(1, (s - p.cum[i - 1]) / seg));
  return { lat: a[0] + (b[0] - a[0]) * t, lng: a[1] + (b[1] - a[1]) * t, brg: vhBrg({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) };
}
async function vhRoute(a, b) {   // road route (OSRM); falls back to a straight line if the service is unreachable
  try {
    const rt = (await (await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`)).json()).routes?.[0];
    if (rt) return rt.geometry.coordinates.map(([x, y]) => [y, x]);
  } catch (e) { /* offline */ }
  return [[a.lat, a.lng], [b.lat, b.lng]];
}
