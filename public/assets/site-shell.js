(()=>{
  const header=document.getElementById("siteHeader");
  if(!header || header.hasAttribute("data-nav-native")) return;
  const main=document.querySelector("main");
  const footer=document.querySelector("footer");
  const menuToggle=document.getElementById("menuToggle");
  const mobileMenu=document.getElementById("mobileMenu");
  const mobilePanel=mobileMenu?.querySelector(".mobile-menu__panel");
  const megaItems=[...document.querySelectorAll("[data-mega-item]")];
  const desktopQuery=window.matchMedia("(min-width: 821px)");
  let mobileOpen=false, closeTimer=null, previousFocus=null;
  const closeMegaMenus=except=>{megaItems.forEach(item=>{if(item===except)return;item.classList.remove("is-open");item.querySelector(".desktop-nav__trigger")?.setAttribute("aria-expanded","false")})};
  const openMegaMenu=item=>{if(!desktopQuery.matches)return;clearTimeout(closeTimer);closeMegaMenus(item);item.classList.add("is-open");item.querySelector(".desktop-nav__trigger")?.setAttribute("aria-expanded","true")};
  const scheduleMegaClose=item=>{clearTimeout(closeTimer);closeTimer=setTimeout(()=>{item.classList.remove("is-open");item.querySelector(".desktop-nav__trigger")?.setAttribute("aria-expanded","false")},120)};
  megaItems.forEach(item=>{const trigger=item.querySelector(".desktop-nav__trigger");trigger?.addEventListener("click",e=>{e.stopPropagation();const willOpen=!item.classList.contains("is-open");closeMegaMenus(willOpen?item:null);item.classList.toggle("is-open",willOpen);trigger.setAttribute("aria-expanded",String(willOpen))});item.addEventListener("pointerenter",()=>openMegaMenu(item));item.addEventListener("pointerleave",()=>scheduleMegaClose(item));item.addEventListener("focusin",()=>openMegaMenu(item));item.addEventListener("focusout",e=>{if(!item.contains(e.relatedTarget))scheduleMegaClose(item)})});
  document.addEventListener("click",e=>{if(!e.target.closest("[data-mega-item]"))closeMegaMenus()});
  const setPageInert=inert=>{[main,footer].filter(Boolean).forEach(el=>{if("inert" in el){el.inert=inert;return}if(inert){el.dataset.previousAriaHidden=el.getAttribute("aria-hidden")||"";el.setAttribute("aria-hidden","true")}else{const prev=el.dataset.previousAriaHidden;if(prev)el.setAttribute("aria-hidden",prev);else el.removeAttribute("aria-hidden");delete el.dataset.previousAriaHidden}})};
  const getFocusable=()=>mobilePanel?[...mobilePanel.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null):[];
  const openMobileMenu=()=>{if(!mobileMenu||mobileOpen)return;previousFocus=document.activeElement;mobileOpen=true;closeMegaMenus();mobileMenu.classList.add("is-open");mobileMenu.setAttribute("aria-hidden","false");menuToggle?.setAttribute("aria-expanded","true");menuToggle?.setAttribute("aria-label","Close menu");document.body.classList.add("mobile-menu-lock");setPageInert(true);requestAnimationFrame(()=>mobileMenu.querySelector(".mobile-menu__close")?.focus())};
  const closeMobileMenu=()=>{if(!mobileMenu||!mobileOpen)return;mobileOpen=false;mobileMenu.classList.remove("is-open");mobileMenu.setAttribute("aria-hidden","true");menuToggle?.setAttribute("aria-expanded","false");menuToggle?.setAttribute("aria-label","Open menu");document.body.classList.remove("mobile-menu-lock");setPageInert(false);if(previousFocus instanceof HTMLElement)previousFocus.focus()};
  menuToggle?.addEventListener("click",()=>mobileOpen?closeMobileMenu():openMobileMenu());
  mobileMenu?.querySelectorAll("[data-mobile-close]").forEach(c=>c.addEventListener("click",closeMobileMenu));
  mobileMenu?.querySelectorAll("[data-mobile-link]").forEach(a=>a.addEventListener("click",closeMobileMenu));
  mobileMenu?.querySelectorAll(".mobile-nav__toggle").forEach(toggle=>toggle.addEventListener("click",()=>{const group=toggle.closest(".mobile-nav__group");const willOpen=!group?.classList.contains("is-open");mobileMenu.querySelectorAll(".mobile-nav__group").forEach(other=>{if(other===group)return;other.classList.remove("is-open");other.querySelector(".mobile-nav__toggle")?.setAttribute("aria-expanded","false")});group?.classList.toggle("is-open",willOpen);toggle.setAttribute("aria-expanded",String(willOpen))}));
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){mobileOpen?closeMobileMenu():closeMegaMenus()}if(e.key==="Tab"&&mobileOpen){const f=getFocusable();if(!f.length)return;const first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
  let scrollFrame=0;const updateScrollState=()=>{scrollFrame=0;header.classList.toggle("is-scrolled",scrollY>18);if(desktopQuery.matches&&scrollY>20)closeMegaMenus()};const scheduleScrollUpdate=()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(updateScrollState)};addEventListener("scroll",scheduleScrollUpdate,{passive:true});updateScrollState();addEventListener("resize",()=>{if(desktopQuery.matches&&mobileOpen)closeMobileMenu()},{passive:true});
})();

// Make selected content cards fully clickable without nesting anchors.
(()=>{document.querySelectorAll('[data-card-href]').forEach(card=>{const go=()=>{const href=card.getAttribute('data-card-href');if(href)location.href=href};card.addEventListener('click',e=>{if(e.target.closest('a,button,input,select,textarea,label'))return;go()});card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('a,button,input,select,textarea')){e.preventDefault();go()}})})})();
