// Launch splash (v24): a flat 2D drone-view of the Biyahe city, drawn in SVG. Palms and trees sway, clouds drift, a rider loops the
// sun roundabout and rides the yellow route to the pin. The logo pops in, the tagline wipes in, a loading bar fills, then it fades into the app.
// Include as the FIRST script inside <body>. Tap to skip. Fires "biyahe:splash-done" when it is gone.
(function () {
  if (window.__biyaheSplash) return;
  window.__biyaheSplash = true;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var weak = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);   // low-end phone: still map, no moving rider
  var SHOW_MS = reduce ? 1200 : weak ? 2800 : 3400;

  var el = document.createElement('div');
  el.id = 'splash';
  if (weak || reduce) el.classList.add('lite');
  el.setAttribute('role', 'presentation');
  el.style.setProperty('--dur', (SHOW_MS - 600) / 1000 + 's');
  el.innerHTML = '<div class="sp-art">' + '<div class="sp-stage">' + "<svg aria-hidden=\"true\" class=\"sp-map\" viewBox=\"0 0 400 800\" preserveAspectRatio=\"xMidYMin slice\">\n<defs>\n<pattern id=\"sp-sb\" width=\"12\" height=\"10\" patternUnits=\"userSpaceOnUse\"><rect width=\"6\" height=\"10\" fill=\"#1f4fd8\"/><rect x=\"6\" width=\"6\" height=\"10\" fill=\"#fff\"/></pattern>\n<pattern id=\"sp-sy\" width=\"12\" height=\"10\" patternUnits=\"userSpaceOnUse\"><rect width=\"6\" height=\"10\" fill=\"#ffc93c\"/><rect x=\"6\" width=\"6\" height=\"10\" fill=\"#fff\"/></pattern>\n<radialGradient id=\"sp-cg\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".95\"/><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\"0\"/></radialGradient>\n<linearGradient id=\"sp-fd\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\"0\"/><stop offset=\".45\" stop-color=\"#fff\" stop-opacity=\".92\"/><stop offset=\"1\" stop-color=\"#fff\"/></linearGradient>\n<symbol id=\"sp-palm\" viewBox=\"0 0 100 100\"><g id=\"sp-fr\"><path d=\"M50 50C41 32 43 13 50 3C57 13 59 32 50 50Z\" fill=\"#37a84a\"/><path d=\"M50 48C47 32 48 18 50 8\" stroke=\"#8fe08f\" stroke-width=\"1.5\" fill=\"none\" stroke-linecap=\"round\"/></g>\n<use href=\"#sp-fr\" transform=\"rotate(45 50 50)\"/><use href=\"#sp-fr\" transform=\"rotate(90 50 50)\"/><use href=\"#sp-fr\" transform=\"rotate(135 50 50)\"/><use href=\"#sp-fr\" transform=\"rotate(180 50 50)\"/><use href=\"#sp-fr\" transform=\"rotate(225 50 50)\"/><use href=\"#sp-fr\" transform=\"rotate(270 50 50)\"/><use href=\"#sp-fr\" transform=\"rotate(315 50 50)\"/>\n<circle cx=\"50\" cy=\"50\" r=\"7\" fill=\"#5cc96b\"/><circle cx=\"48\" cy=\"48\" r=\"3\" fill=\"#8b5e34\"/><circle cx=\"53\" cy=\"52\" r=\"2.5\" fill=\"#8b5e34\"/></symbol>\n<symbol id=\"sp-tree\" viewBox=\"0 0 100 100\"><circle cx=\"54\" cy=\"58\" r=\"36\" fill=\"#2b8f45\"/><circle cx=\"46\" cy=\"48\" r=\"32\" fill=\"#3fb257\"/><circle cx=\"60\" cy=\"42\" r=\"22\" fill=\"#59c96a\"/><circle cx=\"38\" cy=\"36\" r=\"14\" fill=\"#7fdc86\"/></symbol>\n</defs>\n<rect width=\"400\" height=\"800\" fill=\"#f2f6ff\"/>\n<g id=\"sp-roads\" fill=\"#e3e9f5\"><rect x=\"170\" y=\"-20\" width=\"60\" height=\"850\"/><rect x=\"-20\" y=\"350\" width=\"440\" height=\"60\"/><rect x=\"-20\" y=\"150\" width=\"440\" height=\"60\"/><rect x=\"300\" y=\"-20\" width=\"60\" height=\"180\"/><circle cx=\"200\" cy=\"380\" r=\"62\"/></g>\n<g id=\"sp-marks\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.5\" stroke-dasharray=\"10 8\"><path d=\"M200 0V145M200 470V830M0 380H118M282 380H420M0 180H170M340 180H420M330 0V110\"/></g>\n<g id=\"sp-zebra\" fill=\"#fff\"></g>\n<circle cx=\"200\" cy=\"380\" r=\"46\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\" stroke-dasharray=\"8 8\" opacity=\".9\"/>\n<circle cx=\"200\" cy=\"380\" r=\"34\" fill=\"#f7faff\" stroke=\"#fff\" stroke-width=\"3\"/>\n<g id=\"sp-sun\"></g>\n<g id=\"sp-blds\"></g>\n<g id=\"sp-route\"><path id=\"sp-rt\" d=\"M200 334V196Q200 180 216 180H314Q330 180 330 164V112\" fill=\"none\" stroke=\"#ffc93c\" stroke-opacity=\".35\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n<use href=\"#sp-rt\" style=\"stroke:#ffc93c;stroke-opacity:1;stroke-width:5\" fill=\"none\"/>\n\n\n\n\n<g id=\"sp-trees\"></g>\n<g fill=\"url(#sp-cg)\"><ellipse cx=\"20\" cy=\"250\" rx=\"70\" ry=\"44\"/><ellipse cx=\"410\" cy=\"470\" rx=\"76\" ry=\"40\"/><ellipse cx=\"30\" cy=\"520\" rx=\"90\" ry=\"44\"/></g>\n<rect y=\"500\" width=\"400\" height=\"330\" fill=\"url(#sp-fd)\"/>\n\n</svg>" + "<svg aria-hidden=\"true\" class=\"sp-map sp-fx\" viewBox=\"0 0 400 800\" preserveAspectRatio=\"xMidYMin slice\">\n<path class=\"sp-flow\" d=\"M200 334V196Q200 180 216 180H314Q330 180 330 164V112\" fill=\"none\" stroke=\"#fff\" stroke-opacity=\".85\" stroke-width=\"1.6\" stroke-dasharray=\"6 16\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n<ellipse class=\"sp-pulse\" cx=\"330\" cy=\"114\" rx=\"16\" ry=\"8\" fill=\"none\" stroke=\"#1f4fd8\" stroke-width=\"2\"/>\n<g id=\"sp-rider\"><animateMotion dur=\"4s\" repeatCount=\"indefinite\" rotate=\"auto\" calcMode=\"spline\" keyTimes=\"0;1\" keySplines=\".45 0 .55 1\" path=\"M200 426A46 46 0 0 1 154 380A46 46 0 0 1 200 334V196Q200 180 216 180H314Q330 180 330 164V118\"/>\n<animate attributeName=\"opacity\" dur=\"4s\" repeatCount=\"indefinite\" values=\"0;1;1;0\" keyTimes=\"0;.05;.93;1\"/>\n<g transform=\"scale(1.15)\"><ellipse cx=\"0\" cy=\"3\" rx=\"19\" ry=\"8\" fill=\"#14287a\" opacity=\".18\"/>\n<rect x=\"-19\" y=\"-7.5\" width=\"15\" height=\"15\" rx=\"2.5\" fill=\"#ffc93c\" stroke=\"#e0a300\" stroke-width=\"1\"/><path d=\"M-19 0H-4\" stroke=\"#e0a300\"/>\n<rect x=\"-4\" y=\"-4.5\" width=\"24\" height=\"9\" rx=\"4.5\" fill=\"#1f4fd8\"/><rect x=\"16\" y=\"-2\" width=\"7\" height=\"4\" rx=\"2\" fill=\"#1a2650\"/>\n<rect x=\"11\" y=\"-9\" width=\"3\" height=\"18\" rx=\"1.5\" fill=\"#1a2650\"/>\n<ellipse cx=\"3\" cy=\"0\" rx=\"6\" ry=\"8.5\" fill=\"#2f66f2\"/><circle cx=\"5\" cy=\"0\" r=\"5.6\" fill=\"#1f4fd8\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"7\" cy=\"-1.6\" r=\"1.8\" fill=\"#8fb0ff\"/></g></g>\n<g id=\"sp-pin\" transform=\"translate(330 100)\"><g class=\"sp-bob\"><path d=\"M0 0C-4-8-15-16-15-27A15 15 0 1 1 15-27C15-16 4-8 0 0Z\" fill=\"#1f4fd8\" stroke=\"#fff\" stroke-width=\"2\"/><circle cy=\"-27\" r=\"5.5\" fill=\"#fff\"/></g></g>\n</svg>" + '</div>' + "<div class=\"sp-brand\"><img class=\"sp-logo\" alt=\"\" decoding=\"async\" src=\"assets/splash-logo.webp\"><img class=\"sp-tag\" alt=\"\" decoding=\"async\" src=\"assets/splash-tag.webp\"></div><div class=\"sp-load\"><i></i></div>" + '</div>';
  document.body.insertBefore(el, document.body.firstChild);
  document.body.classList.add('splashing');
  var svgEl = el.querySelector('.sp-fx');
  if (svgEl.pauseAnimations) svgEl.pauseAnimations();   // rider starts only when the splash starts

  // ---- build the scene (top-down roofs, roads, trees) ----

var $=function(id){return el.querySelector('#sp-'+id)};
// crosswalks
var z='';for(var i=0;i<6;i++){var o=174+i*9;z+=`<rect x="${o}" y="292" width="5" height="11"/><rect x="${o}" y="457" width="5" height="11"/>`;var q=354+i*9;z+=`<rect x="116" y="${q}" width="11" height="5"/><rect x="273" y="${q}" width="11" height="5"/>`}
$('zebra').innerHTML=z;
// Philippine sun: 8 triple rays around a disc
var s='<circle cx="200" cy="380" r="15" fill="#ffc93c"/>';
for(var k=0;k<8;k++){var a=k*45;s+=`<g transform="rotate(${a} 200 380)"><path d="M196 362L200 342L204 362Z" fill="#ffc93c" transform="translate(0 -1)"/><path d="M188 364L186 350L192 362Z" fill="#ffd96a" transform="rotate(-6 200 380)"/><path d="M212 364L214 350L208 362Z" fill="#ffd96a" transform="rotate(6 200 380)"/></g>`}
$('sun').innerHTML=s;
// buildings (top-down roofs)
var ico={f:'<path d="M-7-9v6a3 3 0 0 0 3 3v9h2v-9a3 3 0 0 0 3-3v-6h-1.5v5h-1v-5h-1v5h-1v-5z" fill="#fff"/><ellipse cx="7" cy="-4.5" rx="3.3" ry="5" fill="#fff"/><rect x="6" y="0" width="2" height="9" fill="#fff"/>',
p:'<path d="M-9-4L0-9l9 5v9L0 10-9 5z" fill="#fff"/><path d="M-9-4L0 1 9-4M0 1v9" stroke="#ffc93c" stroke-width="1.5" fill="none"/>'};
function B(x,y,w,h,o={}){var g=`<rect x="${x-8}" y="${y-8}" width="${w+16}" height="${h+16}" rx="12" fill="#fafcff" stroke="#e0e7f6"/>`;
g+=`<rect x="${x+4}" y="${y+7}" width="${w}" height="${h}" rx="8" fill="#1f4fd8" opacity=".09"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#fff" stroke="#d3ddf3" stroke-width="1.5"/><rect x="${x+7}" y="${y+7}" width="${w-14}" height="${h-14}" rx="4" fill="${o.r||'#f4f8ff'}"/>`;
g+=`<rect x="${x+7}" y="${y+7}" width="${w-14}" height="6" rx="3" fill="${o.t||'#1f4fd8'}" opacity=".9"/>`;
g+=`<rect x="${x+w-34}" y="${y+h-34}" width="18" height="18" rx="3" fill="#e2e9f7" stroke="#cfd9ef"/><circle cx="${x+w-25}" cy="${y+h-25}" r="6" fill="#f7faff" stroke="#c5d2ee"/>`;
g+=`<rect x="${x+18}" y="${y+h-30}" width="14" height="14" rx="3" fill="#e2e9f7" stroke="#cfd9ef"/>`;
if(o.aw){var ay=o.aw=='b'?y+h-2:y-14;g+=`<rect x="${x+8}" y="${ay}" width="${w-16}" height="16" rx="3" fill="url(#sp-${o.y?'sy':'sb'})" stroke="${o.y?'#e0a300':'#1f4fd8'}" stroke-width="1"/>`}
if(o.i){g+=`<g transform="translate(${x+w/2} ${y+h/2-2})"><circle r="19" fill="#ffc93c" stroke="#fff" stroke-width="3"/>${ico[o.i]}</g>`}
return g}
$('blds').innerHTML=
B(14,26,148,112,{aw:'b',i:'f'})+B(238,22,54,116,{r:'#eaf1ff'})+B(372,18,50,120)+
B(-10,224,156,108,{aw:'t',r:'#e6eeff'})+B(254,224,156,108,{aw:'t',y:1,i:'p',t:'#ffc93c'})+
B(-10,436,140,104)+B(270,436,140,110,{r:'#eaf1ff'});
// trees: [type,x,y,size,delay,duration]
var T=[['p',20,24,46],['t',158,130,26],['t',232,148,24],['t',300,30,28],['p',392,150,40],['t',372,72,30],
['t',252,334,26],['p',394,232,40],['p',22,334,38],['t',146,226,30],['t',132,338,22],['p',150,300,30],
['p',20,448,42],['t',138,470,26],['t',30,528,22],['p',380,450,44],['t',276,520,24],['p',290,444,34],['t',225,150,18]];
var tr='';T.forEach(([k,x,y,s],i)=>{var d=(-(i*0.83)%4).toFixed(2),t=(3.2+(i%5)*.45).toFixed(2);
tr+=`<g transform="translate(${x} ${y})"><ellipse cx="4" cy="6" rx="${s*.42}" ry="${s*.36}" fill="#14603a" opacity=".16"/><g><use href="#sp-${k=='p'?'palm':'tree'}" x="${-s/2}" y="${-s/2}" width="${s}" height="${s}"/></g></g>`});
$('trees').innerHTML=tr;

  // ---- timing ----
  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    el.classList.add('out');
    document.body.classList.remove('splashing');
    setTimeout(function () {
      el.remove();
      document.dispatchEvent(new Event('biyahe:splash-done'));
    }, 520);
  }

  // Start the clock once the logo + tagline are ready (never wait more than 2.5 s for them).
  var imgs = el.querySelectorAll('img'), left = imgs.length, begun = false;
  function begin() {
    if (begun || finished) return;
    begun = true;
    if (svgEl.unpauseAnimations) svgEl.unpauseAnimations();
    requestAnimationFrame(function () { el.classList.add('go'); });
    setTimeout(finish, SHOW_MS);
  }
  function one() { if (--left <= 0) begin(); }
  Array.prototype.forEach.call(imgs, function (i) {
    if (i.complete && i.naturalWidth) one(); else { i.addEventListener('load', one); i.addEventListener('error', one); }
  });
  setTimeout(begin, 2500);
  el.addEventListener('click', finish);
})();
