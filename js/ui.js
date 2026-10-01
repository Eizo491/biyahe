// Shared helpers for the Biyahe login and screen transitions.
// One page, three screens: #auth (login), #app (customer dashboard), #rapp (rider dashboard).
window.UI=(()=>{
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const MORPH=550, HOLD=1700;            // ms: button morph, then how long the success card stays
  let pending=null, celebrating=false;   // pending = a sign-in the user just started

  // Keeps the button disabled while it shows the success state.
  const busy=(b,on)=>{b.classList.toggle("busy",on);b.disabled=on||b.classList.contains("ok")};
  const shake=()=>{const f=$(".fields");f.classList.remove("shake");void f.offsetWidth;f.classList.add("shake")};

  // Plain screen swap: login <-> a dashboard, or one dashboard -> the other (customer becomes rider).
  const SCREENS=["#auth","#app","#rapp","#aapp"];
  const shown=el=>getComputedStyle(el).display!=="none";
  const swap=(loggedIn,dash="#app")=>{
    const to=$(loggedIn?dash:"#auth");
    if(shown(to)&&!to.classList.contains("out"))return;
    const others=SCREENS.map($).filter(el=>el!==to);
    const go=()=>{document.body.classList.toggle("wide",to.id==="aapp");others.forEach(el=>{el.style.display="none";el.classList.remove("out")});to.classList.remove("out");to.style.display=to.id==="auth"?"block":"flex"};
    const leaving=others.filter(shown);
    if(!leaving.length)go();else{leaving.forEach(el=>el.classList.add("out"));setTimeout(go,300)}
  };

  const nameOf=u=>{
    const m=u?.user_metadata||{};
    const n=m.full_name||m.name||(u?.email||"").split("@")[0];
    return n.replace(/[._-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase()).trim();
  };

  // Call right before a sign-in / sign-up request. Tells UI.show(true) to celebrate first.
  const begin=(btn,kind="in",next="Getting things ready…")=>{pending={btn,kind,next}};
  // Call when the request failed, so no celebration is queued.
  const end=()=>{if(!celebrating)pending=null};

  // The success card shared by sign-in and "you're now a rider".
  const card=(title,msg,email)=>`<div class="wcard" style="--dur:${HOLD}ms">
        <div class="wbadge"><svg viewBox="0 0 76 76" aria-hidden="true"><circle class="wr" cx="38" cy="38" r="34"/><path class="wc" d="M24 39l10 10 19-21"/></svg></div>
        <h2 class="wt">${title}</h2>
        <p class="wm">${msg}</p>
        ${email?`<div class="wuser">${esc(email)}</div>`:""}
        <div class="wbar"></div></div>`;

  const celebrate=(user,dash,over)=>{
    celebrating=true;
    const {btn,kind,next:n0}=pending, up=kind==="up", next=over||n0;
    const lbl=btn&&(btn.querySelector(".lbl")||btn), old=lbl&&lbl.textContent;
    if(btn){                                   // 1. icon animates, button turns green
      btn.classList.remove("busy");btn.classList.add("ok");btn.disabled=true;
      lbl.textContent=up?"Account created":"Signed in";
    }
    const name=nameOf(user), hi=name?`, ${esc(name)}`:"";
    let timer;
    setTimeout(()=>{                           // 2. professional success message
      const o=document.createElement("div");
      o.id="welcome";o.setAttribute("role","status");
      o.innerHTML=card(up?"Account created":"Signed in successfully",`${up?"Welcome to Biyahe":"Welcome back"}${hi}. ${esc(next)}`,user?.email);
      document.body.appendChild(o);
      const close=()=>{                        // 3. hand over to the app
        clearTimeout(timer);o.onclick=null;
        o.classList.add("leave");swap(true,dash);
        setTimeout(()=>{o.remove();
          if(btn){btn.classList.remove("ok");btn.disabled=false;lbl.textContent=old}
          pending=null;celebrating=false},350);
      };
      o.onclick=close;                         // tap anywhere to skip
      timer=setTimeout(close,HOLD);
    },MORPH);
  };

  // loggedIn=true after a fresh sign-in -> celebrate first; a restored session goes straight in.
  // dash = which dashboard to land on ("#app" customer, "#rapp" rider); next = optional override of the card's last line.
  const show=(loggedIn,user,dash="#app",next)=>{
    if(loggedIn&&pending){if(!celebrating)celebrate(user,dash,next);return}
    if(!loggedIn&&!celebrating)pending=null;
    swap(loggedIn,dash);
  };

  // A signed-in customer just became a rider: same success card, then swap dashboards.
  const promote=(user,dash="#rapp")=>{
    if(celebrating)return;
    celebrating=true;
    const name=nameOf(user), hi=name?`, ${esc(name)}`:"";
    const o=document.createElement("div");
    o.id="welcome";o.setAttribute("role","status");
    o.innerHTML=card("You're now a Biyahe rider",`Welcome to the team${hi}. Loading open bookings…`,user?.email);
    document.body.appendChild(o);
    let timer;
    const close=()=>{
      clearTimeout(timer);o.onclick=null;
      o.classList.add("leave");swap(true,dash);
      setTimeout(()=>{o.remove();celebrating=false},350);
    };
    o.onclick=close;
    timer=setTimeout(close,HOLD);
  };

  // Sign out with a short "Signing out..." card that turns into a check, then fades to the login.
  const signOut=async fn=>{
    if($("#bye"))return;
    const o=document.createElement("div");
    o.id="bye";o.setAttribute("role","status");
    o.innerHTML=`<div class="wcard"><div class="bslot"><div class="bspin"></div></div><h2 class="wt">Signing out…</h2><p class="wm">Closing your session securely.</p></div>`;
    document.body.appendChild(o);
    const wait=ms=>new Promise(r=>setTimeout(r,ms)), t0=Date.now();
    try{await fn()}catch(e){}
    await wait(Math.max(0,900-(Date.now()-t0)));
    const set=(el,t)=>{el.textContent=t;el.style.animation="none";void el.offsetWidth;el.style.animation=""};
    o.querySelector(".bslot").innerHTML='<div class="wbadge"><svg viewBox="0 0 76 76" aria-hidden="true"><circle class="wr" cx="38" cy="38" r="34"/><path class="wc" d="M24 39l10 10 19-21"/></svg></div>';
    set(o.querySelector(".wt"),"Signed out");set(o.querySelector(".wm"),"See you soon.");
    await wait(1000);
    o.classList.add("leave");setTimeout(()=>o.remove(),350);
  };

  document.querySelectorAll(".eye").forEach(b=>b.onclick=()=>{
    const i=b.previousElementSibling,s=i.type==="password";
    i.type=s?"text":"password";b.textContent=s?"Hide":"Show";b.setAttribute("aria-pressed",s)});
  const pw=$("#pw");if(pw)pw.addEventListener("keydown",e=>{if(e.key==="Enter")$("#signin").click()});
  return{busy,shake,show,begin,end,promote,signOut};
})();
