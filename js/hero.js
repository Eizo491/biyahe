// Login hero: a looping drone-view ride through the Biyahe city (same look as the splash). Themed with the app's CSS colours.
(function () {
  var hero = document.querySelector('#auth .hero'); if (!hero) return;
  var i = 0;
  function tree(x, y, s) { i++; var d = (-(i * .9) % 4).toFixed(1), t = (3 + (i % 4) * .5).toFixed(1);
    return '<g transform="translate(' + x + ' ' + y + ')"><ellipse cx="3" cy="4" rx="' + s * .42 + '" ry="' + s * .34 + '" fill="#14603a" opacity=".16"/><g class="h-sw" style="--d:' + d + 's;--t:' + t + 's"><circle cx="' + s * .08 + '" cy="' + s * .1 + '" r="' + s * .46 + '" fill="#2b8f45"/><circle cx="0" cy="0" r="' + s * .42 + '" fill="#3fb257"/><circle cx="' + s * .12 + '" cy="' + -s * .1 + '" r="' + s * .28 + '" fill="#59c96a"/><circle cx="' + -s * .14 + '" cy="' + -s * .16 + '" r="' + s * .15 + '" fill="#7fdc86"/></g></g>'; }
  function palm(x, y, s) { i++; var d = (-(i * .9) % 4).toFixed(1), t = (3 + (i % 4) * .5).toFixed(1), f = '';
    for (var k = 0; k < 8; k++) f += '<path transform="rotate(' + k * 45 + ')" d="M0 0C-5-9-4-17 0-22C4-17 5-9 0 0Z" fill="' + (k % 2 ? '#37a84a' : '#4cbd5c') + '"/>';
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s / 44 + ')"><ellipse cx="4" cy="6" rx="18" ry="15" fill="#14603a" opacity=".14"/><g class="h-sw h-p" style="--d:' + d + 's;--t:' + t + 's">' + f + '<circle r="4" fill="#5cc96b"/><circle cx="-1" cy="-1" r="2" fill="#8b5e34"/></g></g>'; }
  var ico = { f: '<path d="M-4-6v4a2 2 0 0 0 2 2v6h1.4v-6a2 2 0 0 0 2-2v-4h-1v3.4h-.7v-3.4h-.8v3.4h-.7v-3.4z" fill="#fff"/><ellipse cx="4.6" cy="-3" rx="2.1" ry="3.3" fill="#fff"/><rect x="4" y="0" width="1.3" height="6" fill="#fff"/>',
    p: '<path d="M-6-2.5L0-6l6 3.5v6L0 7-6 3.5z" fill="#fff"/><path d="M-6-2.5L0 1l6-3.5M0 1v6" stroke="var(--sun)" stroke-width="1.1" fill="none"/>' };
  function B(x, y, w, h, o) { o = o || {};
    var g = '<rect class="h-pad" x="' + (x - 5) + '" y="' + (y - 5) + '" width="' + (w + 10) + '" height="' + (h + 10) + '" rx="9"/><rect x="' + (x + 3) + '" y="' + (y + 4) + '" width="' + w + '" height="' + h + '" rx="6" fill="var(--pri)" opacity=".1"/><rect class="h-roof" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6"/><rect x="' + (x + 5) + '" y="' + (y + 5) + '" width="' + (w - 10) + '" height="4" rx="2" style="fill:' + (o.y ? 'var(--sun)' : 'var(--pri)') + '"/><rect class="h-ac" x="' + (x + w - 20) + '" y="' + (y + h - 20) + '" width="11" height="11" rx="2"/><circle class="h-fan" cx="' + (x + w - 14.5) + '" cy="' + (y + h - 14.5) + '" r="3.4"/>';
    if (o.a) { var ay = o.a == 'b' ? y + h - 1 : y - 9; g += '<rect x="' + (x + 5) + '" y="' + ay + '" width="' + (w - 10) + '" height="10" rx="2.5" fill="url(#' + (o.y ? 'hp-y' : 'hp-b') + ')" stroke="' + (o.y ? '#d99a00' : 'var(--pri)') + '" stroke-width=".8"/>'; }
    if (o.i) g += '<g transform="translate(' + (x + w / 2 - 3) + ' ' + (y + h / 2 + 1) + ')"><circle r="12" fill="var(--sun)" stroke="#fff" stroke-width="2"/>' + ico[o.i] + '</g>';
    return g; }
  function tile(dx) { var s = '<g transform="translate(' + dx + ' 0)"><rect class="h-road" x="0" y="68" width="440" height="40"/><rect class="h-road" x="282" y="0" width="36" height="176"/><circle class="h-road" cx="300" cy="88" r="31"/>' +
      '<path d="M0 88H268M332 88H440" stroke="var(--card)" stroke-width="2.2" stroke-dasharray="12 12" fill="none" opacity=".9"/><circle cx="300" cy="88" r="19" class="h-pad"/>' +
      '<g class="h-spin" style="transform-origin:300px 88px"><circle cx="300" cy="88" r="6.5" fill="var(--sun)"/>';
    for (var k = 0; k < 8; k++) s += '<path transform="rotate(' + k * 45 + ' 300 88)" d="M300 77.5v-6" stroke="var(--sun)" stroke-width="2.6" stroke-linecap="round"/>';
    s += '</g>' + B(10, 8, 70, 46, { a: 'b', i: 'f' }) + B(92, 8, 54, 46) + B(158, 8, 96, 46, { a: 'b', y: 1, i: 'p' }) + B(340, 8, 82, 46, { a: 'b' }) +
      B(12, 122, 60, 46, { a: 't' }) + B(86, 122, 84, 46, { a: 't', y: 1, i: 'p' }) + B(184, 122, 70, 46, { a: 't' }) + B(344, 122, 78, 46, { a: 't', i: 'f' }) +
      tree(150, 16, 20) + palm(262, 20, 28) + palm(330, 14, 26) + tree(428, 56, 18) + palm(80, 158, 28) + tree(176, 160, 20) + tree(262, 160, 22) + palm(334, 160, 28) + tree(430, 128, 20) + tree(4, 112, 16);
    return s + '</g>'; }
  hero.innerHTML = '<svg viewBox="0 0 440 176" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>' +
    '<pattern id="hp-b" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="5" height="10" style="fill:var(--pri)"/><rect x="5" width="5" height="10" fill="#fff"/></pattern>' +
    '<pattern id="hp-y" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="5" height="10" fill="#ffc93c"/><rect x="5" width="5" height="10" fill="#fff"/></pattern>' +
    '<filter id="hp-bl" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="7"/></filter></defs>' +
    '<g class="h-scroll">' + tile(0) + tile(440) + '</g>' +
    '<path d="M138 88H388" stroke="var(--sun)" stroke-opacity=".4" stroke-width="10" stroke-linecap="round"/><path d="M138 88H388" stroke="var(--sun)" stroke-width="4.5" stroke-linecap="round"/><path class="h-flow" d="M138 88H388" stroke="#fff" stroke-opacity=".9" stroke-width="1.4" stroke-dasharray="5 13" fill="none"/>' +
    '<ellipse class="h-pulse" cx="392" cy="90" rx="13" ry="6" fill="none" stroke="var(--pri)" stroke-width="1.8"/><g transform="translate(392 86) scale(.72)"><g class="h-bob"><path d="M0 0C-4-8-15-16-15-27A15 15 0 1 1 15-27C15-16 4-8 0 0Z" fill="var(--pri)" stroke="#fff" stroke-width="2.2"/><circle cy="-27" r="5.5" fill="#fff"/></g></g>' +
    '<g transform="translate(120 88)"><g class="h-rider"><g stroke="#fff" stroke-linecap="round" opacity=".85" class="h-speed"><path d="M-34-6h-14M-38 0h-20M-34 6h-14" stroke-width="2"/></g><g transform="scale(1.45)"><ellipse cy="3" rx="19" ry="8" fill="#14287a" opacity=".2"/><rect x="-19" y="-7.5" width="15" height="15" rx="2.5" fill="#ffc93c" stroke="#d99a00"/><path d="M-19 0H-4" stroke="#d99a00"/><rect x="-4" y="-4.5" width="24" height="9" rx="4.5" fill="var(--pri)"/><rect x="16" y="-2" width="7" height="4" rx="2" fill="#1a2650"/><rect x="11" y="-9" width="3" height="18" rx="1.5" fill="#1a2650"/><ellipse cx="3" rx="6" ry="8.5" style="fill:color-mix(in srgb,var(--pri) 80%,#fff)"/><circle cx="5" r="5.6" fill="var(--pri)" stroke="#fff"/><circle cx="7" cy="-1.6" r="1.8" fill="#fff" opacity=".6"/></g></g></g>' +
    '<g filter="url(#hp-bl)" fill="#fff" opacity=".75"><ellipse class="h-cl" style="--t:22s" cx="-60" cy="40" rx="48" ry="16"/><ellipse class="h-cl" style="--t:30s;--x:-560px" cx="520" cy="150" rx="56" ry="14"/></g></svg><span class="hero-tag">Ride. Eat. Deliver.</span>';
})();
