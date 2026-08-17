/* ==========================================================================
   page-script-4
   ========================================================================== */
(() => {
      const headerNav = document.querySelector('#siteHeader .nav');
      const pageNavWrap = document.getElementById('pageNavWrap');
      const pageNavShell = document.getElementById('pageNavShell');
      const pageNavToggle = document.getElementById('pageNavToggle');
      const pageNavCurrent = document.getElementById('pageNavCurrent');
      const pageLinks = [...document.querySelectorAll('#pageNavLinks a[href^="#"]')];
      let frame = 0;
      let naturalPageNavTop = pageNavWrap
        ? pageNavWrap.getBoundingClientRect().top + window.scrollY
        : 0;

      const syncNavigationStack = () => {
        frame = 0;
        if (!headerNav || !pageNavWrap) return;

        const primaryBottom = Math.floor(headerNav.getBoundingClientRect().bottom) - 1;
        const wasConnected = pageNavWrap.classList.contains('is-stuck');

        if (!wasConnected) {
          naturalPageNavTop = pageNavWrap.getBoundingClientRect().top + window.scrollY;
        }

        document.documentElement.style.setProperty('--page-nav-top', `${primaryBottom}px`);

        const stickyLine = window.scrollY + primaryBottom;
        const releaseBuffer = wasConnected ? 18 : 1;
        const connected = stickyLine >= naturalPageNavTop - releaseBuffer;

        pageNavWrap.classList.toggle('is-stuck', connected);
        document.getElementById('siteHeader')?.classList.toggle('is-nav-connected', connected);
      };

      const requestStackSync = () => {
        if (frame) return;
        frame = requestAnimationFrame(syncNavigationStack);
      };

      syncNavigationStack();
      window.addEventListener('scroll', requestStackSync, { passive: true });
      window.addEventListener('resize', requestStackSync, { passive: true });
      window.addEventListener('load', syncNavigationStack, { once: true });

      const setPageMenu = open => {
        if (!pageNavShell || !pageNavToggle) return;
        pageNavShell.classList.toggle('is-open', open);
        pageNavToggle.setAttribute('aria-expanded', String(open));
      };

      pageNavToggle?.addEventListener('click', () => setPageMenu(!pageNavShell.classList.contains('is-open')));
      pageLinks.forEach(link => link.addEventListener('click', () => setPageMenu(false)));
      document.addEventListener('click', event => {
        if (pageNavShell && !pageNavShell.contains(event.target)) setPageMenu(false);
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') setPageMenu(false);
      });

      const linkById = new Map(pageLinks.map(link => [link.getAttribute('href').slice(1), link]));
      const sections = [...linkById.keys()].map(id => document.getElementById(id)).filter(Boolean);
      const setActiveLink = id => {
        pageLinks.forEach(link => {
          const active = link.getAttribute('href') === `#${id}`;
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
        const activeLink = linkById.get(id);
        if (activeLink && pageNavCurrent) pageNavCurrent.textContent = activeLink.textContent.trim().replace('↗', '').trim();
      };
      let activeFrame = 0;
      const updateActiveSection = () => {
        activeFrame = 0;
        if (!sections.length) return;
        const navOffset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-nav-top')) || 96;
        const probe = navOffset + 150;
        let active = sections[0];
        sections.forEach(section => {
          if (section.getBoundingClientRect().top <= probe) active = section;
        });
        setActiveLink(active.id);
        const activeLink = linkById.get(active.id);
        const pageNav = document.getElementById('pageNavLinks');
        if (activeLink && pageNav && window.innerWidth > 900) {
          const targetLeft = activeLink.offsetLeft - (pageNav.clientWidth - activeLink.offsetWidth) / 2;
          pageNav.scrollTo({ left: Math.max(0, targetLeft), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }
      };

      const requestActiveSection = () => {
        if (activeFrame) return;
        activeFrame = requestAnimationFrame(updateActiveSection);
      };

      updateActiveSection();
      window.addEventListener('scroll', requestActiveSection, { passive: true });
      window.addEventListener('resize', requestActiveSection, { passive: true });


      // Keep clean production URLs, while allowing downloaded files to link back to the landing page locally.
      if (window.location.protocol === 'file:') {
        const landingFile = 'swishtag-landing-page-footer-solutions-updated.html';
        document.querySelectorAll('a[href="/"], a[href^="/#"]').forEach(link => {
          const href = link.getAttribute('href');
          link.setAttribute('href', href === '/' ? landingFile : `${landingFile}${href.slice(1)}`);
        });
      }
    })();

/* ==========================================================================
   process-connector-logic
   ========================================================================== */
(() => {
    const rail = document.getElementById('processRail');
    const section = document.getElementById('process');
    const svg = document.getElementById('processConnectors');
    const cards = rail ? [...rail.querySelectorAll('.process-card')] : [];
    const paths = svg ? [...svg.querySelectorAll('.process-connector-path')] : [];
    let resizeFrame = 0;

    if (navigator.connection?.saveData) document.documentElement.classList.add('save-data');
    if (!rail || !svg || cards.length < 2 || paths.length < cards.length - 1) return;

    const endpoint = (rect, railRect, side, offset = 3) => {
      const cx = rect.left - railRect.left + rect.width / 2;
      const cy = rect.top - railRect.top + rect.height / 2;
      if (side === 'right') return [rect.right - railRect.left + offset, cy];
      if (side === 'left') return [rect.left - railRect.left - offset, cy];
      if (side === 'bottom') return [cx, rect.bottom - railRect.top + offset];
      return [cx, rect.top - railRect.top - offset];
    };

    const updateConnectors = () => {
      resizeFrame = 0;
      const railRect = rail.getBoundingClientRect();
      if (!railRect.width || !railRect.height) return;
      svg.setAttribute('viewBox', `0 0 ${railRect.width} ${railRect.height}`);

      cards.slice(0, -1).forEach((card, index) => {
        const next = cards[index + 1];
        const a = card.getBoundingClientRect();
        const b = next.getBoundingClientRect();
        const aCenterX = a.left + a.width / 2;
        const bCenterX = b.left + b.width / 2;
        const aCenterY = a.top + a.height / 2;
        const bCenterY = b.top + b.height / 2;
        const sameRow = Math.abs(aCenterY - bCenterY) < Math.min(a.height, b.height) * .34;
        const sameColumn = Math.abs(aCenterX - bCenterX) < Math.min(a.width, b.width) * .34;
        let d = '';

        if (sameRow) {
          const movingRight = bCenterX > aCenterX;
          const [x1, y1] = endpoint(a, railRect, movingRight ? 'right' : 'left');
          const [x2, y2] = endpoint(b, railRect, movingRight ? 'left' : 'right', 7);
          const span = Math.abs(x2 - x1);
          const bend = Math.max(10, Math.min(28, span * .30));
          d = movingRight
            ? `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`
            : `M ${x1} ${y1} C ${x1 - bend} ${y1}, ${x2 + bend} ${y2}, ${x2} ${y2}`;
        } else if (sameColumn || window.innerWidth <= 680) {
          const movingDown = bCenterY > aCenterY;
          const [x1, y1] = endpoint(a, railRect, movingDown ? 'bottom' : 'top');
          const [x2, y2] = endpoint(b, railRect, movingDown ? 'top' : 'bottom', 7);
          const span = Math.abs(y2 - y1);
          const bend = Math.max(10, Math.min(28, span * .30));
          d = movingDown
            ? `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`
            : `M ${x1} ${y1} C ${x1} ${y1 - bend}, ${x2} ${y2 + bend}, ${x2} ${y2}`;
        } else {
          const movingDown = bCenterY > aCenterY;
          const [x1, y1] = endpoint(a, railRect, movingDown ? 'bottom' : 'top');
          const [x2, y2] = endpoint(b, railRect, movingDown ? 'top' : 'bottom', 7);
          const middleY = y1 + (y2 - y1) / 2;
          d = `M ${x1} ${y1} C ${x1} ${middleY}, ${x2} ${middleY}, ${x2} ${y2}`;
        }

        paths[index].setAttribute('d', d);
      });
    };

    const requestUpdate = () => {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(updateConnectors);
    };

    if ('IntersectionObserver' in window && section) {
      const visibilityObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          section.classList.toggle('is-in-view', entry.isIntersecting);
          if (entry.isIntersecting) requestUpdate();
        });
      }, { rootMargin: '140px 0px', threshold: .04 });
      visibilityObserver.observe(section);
    } else {
      section?.classList.add('is-in-view');
    }

    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(requestUpdate);
      resizeObserver.observe(rail);
      cards.forEach(card => resizeObserver.observe(card));
    } else {
      window.addEventListener('resize', requestUpdate, { passive: true });
    }

    window.addEventListener('orientationchange', requestUpdate, { passive: true });
    document.fonts?.ready.then(requestUpdate).catch(() => {});
    requestUpdate();
  })();

/* ==========================================================================
   page-script-6
   ========================================================================== */
(() => {
    const links = [...document.querySelectorAll('#pageNavLinks a[href^="#"]')];
    const getOffset = () => {
      const header = document.getElementById('siteHeader');
      const pageNav = document.getElementById('pageNavShell');
      const headerHeight = header ? header.getBoundingClientRect().height : 82;
      const pageNavHeight = pageNav ? pageNav.getBoundingClientRect().height : 58;
      return headerHeight + pageNavHeight + 22;
    };

    links.forEach(link => {
      link.addEventListener('click', event => {
        const id = link.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - getOffset());
        window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        history.replaceState(null, '', `#${id}`);
      }, { capture: true });
    });

    /* Correct direct hash landings after fonts and layout are ready, without animated flicker. */
    window.addEventListener('load', () => {
      if (!location.hash) return;
      const target = document.getElementById(location.hash.slice(1));
      if (!target) return;
      requestAnimationFrame(() => {
        const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - getOffset());
        window.scrollTo({ top, behavior: 'auto' });
      });
    }, { once: true });
  })();

/* ==========================================================================
   landing-home-navigation-logic
   ========================================================================== */
(() => {
      const header = document.getElementById("siteHeader");
      const main = document.querySelector("main");
      const footer = document.querySelector("footer");
      const menuToggle = document.getElementById("menuToggle");
      const mobileMenu = document.getElementById("mobileMenu");
      const mobilePanel = mobileMenu?.querySelector(".mobile-menu__panel");
      const megaItems = [...document.querySelectorAll("[data-mega-item]")];
      const problemVisual = document.getElementById("problemVisual");
      const stickyCta = document.getElementById("mobileStickyCta");
      const desktopQuery = window.matchMedia("(min-width: 821px)");

      let mobileOpen = false;
      let closeTimer = null;
      let previousFocus = null;

      const closeMegaMenus = except => {
        megaItems.forEach(item => {
          if (item === except) return;
          item.classList.remove("is-open");
          item.querySelector(".desktop-nav__trigger")?.setAttribute("aria-expanded", "false");
        });
      };

      const openMegaMenu = item => {
        if (!desktopQuery.matches) return;
        window.clearTimeout(closeTimer);
        closeMegaMenus(item);
        item.classList.add("is-open");
        item.querySelector(".desktop-nav__trigger")?.setAttribute("aria-expanded", "true");
      };

      const scheduleMegaClose = item => {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(() => {
          item.classList.remove("is-open");
          item.querySelector(".desktop-nav__trigger")?.setAttribute("aria-expanded", "false");
        }, 120);
      };

      megaItems.forEach(item => {
        const trigger = item.querySelector(".desktop-nav__trigger");

        trigger?.addEventListener("click", event => {
          event.stopPropagation();
          const willOpen = !item.classList.contains("is-open");
          closeMegaMenus(willOpen ? item : null);
          item.classList.toggle("is-open", willOpen);
          trigger.setAttribute("aria-expanded", String(willOpen));
        });

        item.addEventListener("pointerenter", () => openMegaMenu(item));
        item.addEventListener("pointerleave", () => scheduleMegaClose(item));
        item.addEventListener("focusin", () => openMegaMenu(item));
        item.addEventListener("focusout", event => {
          if (!item.contains(event.relatedTarget)) scheduleMegaClose(item);
        });
      });

      document.addEventListener("click", event => {
        if (!event.target.closest("[data-mega-item]")) closeMegaMenus();
      });

      const setPageInert = inert => {
        [main, footer].filter(Boolean).forEach(element => {
          if ("inert" in element) {
            element.inert = inert;
            return;
          }

          if (inert) {
            element.dataset.previousAriaHidden = element.getAttribute("aria-hidden") || "";
            element.setAttribute("aria-hidden", "true");
          } else {
            const previous = element.dataset.previousAriaHidden;
            if (previous) element.setAttribute("aria-hidden", previous);
            else element.removeAttribute("aria-hidden");
            delete element.dataset.previousAriaHidden;
          }
        });
      };

      const getFocusable = () => {
        if (!mobilePanel) return [];
        return [...mobilePanel.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )].filter(element => element.offsetParent !== null);
      };

      const openMobileMenu = () => {
        if (!mobileMenu || mobileOpen) return;

        previousFocus = document.activeElement;
        mobileOpen = true;
        closeMegaMenus();

        mobileMenu.classList.add("is-open");
        mobileMenu.setAttribute("aria-hidden", "false");
        menuToggle?.setAttribute("aria-expanded", "true");
        menuToggle?.setAttribute("aria-label", "Close menu");
        document.body.classList.add("mobile-menu-lock");
        setPageInert(true);

        window.requestAnimationFrame(() => {
          mobileMenu.querySelector(".mobile-menu__close")?.focus();
        });
      };

      const closeMobileMenu = () => {
        if (!mobileMenu || !mobileOpen) return;

        mobileOpen = false;
        mobileMenu.classList.remove("is-open");
        mobileMenu.setAttribute("aria-hidden", "true");
        menuToggle?.setAttribute("aria-expanded", "false");
        menuToggle?.setAttribute("aria-label", "Open menu");
        document.body.classList.remove("mobile-menu-lock");
        setPageInert(false);

        if (previousFocus instanceof HTMLElement) previousFocus.focus();
      };

      menuToggle?.addEventListener("click", () => {
        mobileOpen ? closeMobileMenu() : openMobileMenu();
      });

      mobileMenu?.querySelectorAll("[data-mobile-close]").forEach(control => {
        control.addEventListener("click", closeMobileMenu);
      });

      mobileMenu?.querySelectorAll("[data-mobile-link]").forEach(link => {
        link.addEventListener("click", closeMobileMenu);
      });

      mobileMenu?.querySelectorAll(".mobile-nav__toggle").forEach(toggle => {
        toggle.addEventListener("click", () => {
          const group = toggle.closest(".mobile-nav__group");
          const willOpen = !group?.classList.contains("is-open");

          mobileMenu.querySelectorAll(".mobile-nav__group").forEach(otherGroup => {
            if (otherGroup === group) return;
            otherGroup.classList.remove("is-open");
            otherGroup.querySelector(".mobile-nav__toggle")?.setAttribute("aria-expanded", "false");
          });

          group?.classList.toggle("is-open", willOpen);
          toggle.setAttribute("aria-expanded", String(willOpen));
        });
      });

      document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
          if (mobileOpen) {
            closeMobileMenu();
          } else {
            closeMegaMenus();
          }
        }

        if (event.key === "Tab" && mobileOpen) {
          const focusable = getFocusable();
          if (!focusable.length) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      });

      let scrollFrame = 0;

      const updateScrollState = () => {
        scrollFrame = 0;
        header?.classList.toggle("is-scrolled", window.scrollY > 18);
        stickyCta?.classList.toggle("is-visible", window.scrollY > 540);
        if (desktopQuery.matches && window.scrollY > 20) closeMegaMenus();
      };

      const scheduleScrollUpdate = () => {
        if (scrollFrame) return;
        scrollFrame = window.requestAnimationFrame(updateScrollState);
      };

      window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
      updateScrollState();

      window.addEventListener("resize", () => {
        if (desktopQuery.matches && mobileOpen) closeMobileMenu();
      }, { passive: true });

      const revealElements = [...document.querySelectorAll("[data-reveal]")];

      if ("IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
            }
          });
        }, { rootMargin: "80px 0px", threshold: 0.08 });

        revealElements.forEach(element => revealObserver.observe(element));

        if (problemVisual) {
          const problemObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
              problemVisual.classList.toggle("is-connected", entry.isIntersecting);
            });
          }, { threshold: 0.35 });

          problemObserver.observe(problemVisual);
        }
      } else {
        revealElements.forEach(element => element.classList.add("is-visible"));
        problemVisual?.classList.add("is-connected");
      }
    })();

/* ==========================================================================
   conversion-cta-attention-script
   ========================================================================== */
(() => {
    const ctas = [...document.querySelectorAll('.conversion-cta')];
    if (!ctas.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const activate = (cta) => {
      if (cta.dataset.attentionPlayed === 'true') return;
      cta.dataset.attentionPlayed = 'true';
      window.setTimeout(() => cta.classList.add('is-attention-active'), 320);
      cta.addEventListener('animationend', () => {
        cta.classList.remove('is-attention-active');
      }, { once: true });
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          activate(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.72, rootMargin: '0px 0px -6% 0px' });

      ctas.forEach((cta) => observer.observe(cta));
    } else {
      activate(ctas[0]);
    }
  })();

/* ==========================================================================
   simple-sync-route-controller
   ========================================================================== */
(() => {
  const stage = document.getElementById('simpleSyncStage');
  const svg = document.getElementById('simpleSyncRoute');
  const path = document.getElementById('simpleSyncPath');
  const halo = document.getElementById('simpleSyncPathHalo');
  const source = document.getElementById('simpleSyncSource');
  const node = document.getElementById('simpleSyncNode');
  const phone = document.getElementById('simpleSyncPhone');

  if (!stage || !svg || !path || !source || !node || !phone) return;

  let frame = 0;
  const point = (rect, stageRect, xRatio, yRatio) => ({
    x: rect.left - stageRect.left + rect.width * xRatio,
    y: rect.top - stageRect.top + rect.height * yRatio
  });

  const drawRoute = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const stageRect = stage.getBoundingClientRect();
      if (!stageRect.width || !stageRect.height) return;

      svg.setAttribute('viewBox', `0 0 ${stageRect.width} ${stageRect.height}`);

      const sourceRect = source.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const phoneRect = phone.getBoundingClientRect();
      const stacked = stageRect.width < 760;

      let d;
      if (!stacked) {
        const start = point(sourceRect, stageRect, 1, .5);
        const center = point(nodeRect, stageRect, .5, .5);
        const end = point(phoneRect, stageRect, 0, .5);

        // Match the visible dotted orbit that wraps the sync circle.
        const r = Math.max(nodeRect.width, nodeRect.height) / 2 + 14;
        const left = { x: center.x - r, y: center.y };
        const right = { x: center.x + r, y: center.y };

        // Keep both connectors horizontally tangent so they hit the left/right middle of the orbit.
        const leftLead = Math.max(18, Math.min(40, (left.x - start.x) * .36));
        const rightLead = Math.max(18, Math.min(44, (end.x - right.x) * .36));

        d = [
          `M ${start.x} ${start.y}`,
          `C ${start.x + leftLead} ${start.y}, ${left.x - leftLead} ${left.y}, ${left.x} ${left.y}`,
          `A ${r} ${r} 0 1 1 ${right.x} ${right.y}`,
          `A ${r} ${r} 0 1 1 ${left.x} ${left.y}`,
          `A ${r} ${r} 0 0 1 ${right.x} ${right.y}`,
          `C ${right.x + rightLead} ${right.y}, ${end.x - rightLead} ${end.y}, ${end.x} ${end.y}`
        ].join(' ');
      } else {
        const start = point(sourceRect, stageRect, .5, 1);
        const center = point(nodeRect, stageRect, .5, .5);
        const end = point(phoneRect, stageRect, .5, 0);

        const r = Math.max(nodeRect.width, nodeRect.height) / 2 + 13;
        const top = { x: center.x, y: center.y - r };
        const bottom = { x: center.x, y: center.y + r };
        const topLead = Math.max(20, Math.min(42, (top.y - start.y) * .4));
        const bottomLead = Math.max(20, Math.min(42, (end.y - bottom.y) * .34));

        d = [
          `M ${start.x} ${start.y}`,
          `C ${start.x} ${start.y + topLead}, ${top.x} ${top.y - topLead}, ${top.x} ${top.y}`,
          `A ${r} ${r} 0 1 1 ${bottom.x} ${bottom.y}`,
          `A ${r} ${r} 0 1 1 ${top.x} ${top.y}`,
          `A ${r} ${r} 0 0 1 ${bottom.x} ${bottom.y}`,
          `C ${bottom.x} ${bottom.y + bottomLead}, ${end.x} ${end.y - bottomLead}, ${end.x} ${end.y}`
        ].join(' ');
      }

      path.setAttribute('d', d);
      if (halo) halo.setAttribute('d', d);
      svg.querySelectorAll('.simple-sync-motion').forEach((motion) => motion.setAttribute('path', d));
    });
  };

  const observer = new ResizeObserver(drawRoute);
  observer.observe(stage);
  observer.observe(source);
  observer.observe(node);
  observer.observe(phone);
  window.addEventListener('load', drawRoute, { once: true });
  window.addEventListener('resize', drawRoute, { passive: true });
  document.fonts?.ready?.then(drawRoute);
  drawRoute();
})();

/* ==========================================================================
   hero-sync-journey-controller-v11
   ========================================================================== */
(() => {
  const buildJourney = ({ layoutSelector, sourceSelector, orbitSelector, targetSelector, svgSelector, pathId, vertical }) => {
    const layout = document.querySelector(layoutSelector);
    const source = document.querySelector(sourceSelector);
    const orbit = document.querySelector(orbitSelector);
    const target = document.querySelector(targetSelector);
    const svg = document.querySelector(svgSelector);
    const path = document.getElementById(pathId);
    if (!layout || !source || !orbit || !target || !svg || !path) return () => {};

    const relativePoint = (rect, host, xRatio, yRatio) => ({
      x: rect.left - host.left + rect.width * xRatio,
      y: rect.top - host.top + rect.height * yRatio
    });

    const draw = () => {
      const host = layout.getBoundingClientRect();
      const sourceRect = source.getBoundingClientRect();
      const orbitRect = orbit.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (!host.width || !host.height) return;

      svg.setAttribute('viewBox', `0 0 ${host.width} ${host.height}`);
      const center = relativePoint(orbitRect, host, .5, .5);
      const radius = Math.max(orbitRect.width, orbitRect.height) / 2 + 8;
      let d = '';

      if (!vertical) {
        const start = relativePoint(sourceRect, host, 1, .5);
        const end = relativePoint(targetRect, host, 0, .5);
        const left = { x: center.x - radius, y: center.y };
        const top = { x: center.x, y: center.y - radius };
        const right = { x: center.x + radius, y: center.y };
        const bottom = { x: center.x, y: center.y + radius };
        const leadIn = Math.max(20, Math.min(52, (left.x - start.x) * .42));
        const leadOut = Math.max(20, Math.min(52, (end.x - right.x) * .42));

        d = [
          `M ${start.x} ${start.y}`,
          `C ${start.x + leadIn} ${start.y}, ${left.x - leadIn} ${left.y}, ${left.x} ${left.y}`,
          `A ${radius} ${radius} 0 0 1 ${top.x} ${top.y}`,
          `A ${radius} ${radius} 0 0 1 ${right.x} ${right.y}`,
          `A ${radius} ${radius} 0 0 1 ${bottom.x} ${bottom.y}`,
          `A ${radius} ${radius} 0 0 1 ${left.x} ${left.y}`,
          `A ${radius} ${radius} 0 0 1 ${top.x} ${top.y}`,
          `A ${radius} ${radius} 0 0 1 ${right.x} ${right.y}`,
          `C ${right.x + leadOut} ${right.y}, ${end.x - leadOut} ${end.y}, ${end.x} ${end.y}`
        ].join(' ');
      } else {
        const start = relativePoint(sourceRect, host, .5, 1);
        const end = relativePoint(targetRect, host, .5, 0);
        const top = { x: center.x, y: center.y - radius };
        const right = { x: center.x + radius, y: center.y };
        const bottom = { x: center.x, y: center.y + radius };
        const left = { x: center.x - radius, y: center.y };
        const leadIn = Math.max(18, Math.min(44, (top.y - start.y) * .38));
        const leadOut = Math.max(18, Math.min(44, (end.y - bottom.y) * .38));

        d = [
          `M ${start.x} ${start.y}`,
          `C ${start.x} ${start.y + leadIn}, ${top.x} ${top.y - leadIn}, ${top.x} ${top.y}`,
          `A ${radius} ${radius} 0 0 1 ${right.x} ${right.y}`,
          `A ${radius} ${radius} 0 0 1 ${bottom.x} ${bottom.y}`,
          `A ${radius} ${radius} 0 0 1 ${left.x} ${left.y}`,
          `A ${radius} ${radius} 0 0 1 ${top.x} ${top.y}`,
          `A ${radius} ${radius} 0 0 1 ${right.x} ${right.y}`,
          `A ${radius} ${radius} 0 0 1 ${bottom.x} ${bottom.y}`,
          `C ${bottom.x} ${bottom.y + leadOut}, ${end.x} ${end.y - leadOut}, ${end.x} ${end.y}`
        ].join(' ');
      }
      path.setAttribute('d', d);
    };

    const observer = new ResizeObserver(() => requestAnimationFrame(draw));
    [layout, source, orbit, target].forEach((element) => observer.observe(element));
    window.addEventListener('load', draw, { once: true });
    window.addEventListener('resize', draw, { passive: true });
    document.fonts?.ready?.then(draw);
    draw();
    return () => observer.disconnect();
  };

  buildJourney({
    layoutSelector: '.sync-desktop-layout',
    sourceSelector: '.desktop-sage-card',
    orbitSelector: '.desktop-sync-system .sync-orbit',
    targetSelector: '.desktop-phone-zone .simple-sync-phone',
    svgSelector: '.sync-journey--desktop',
    pathId: 'syncJourneyDesktopPath',
    vertical: false
  });

  buildJourney({
    layoutSelector: '.sync-mobile-layout',
    sourceSelector: '.mobile-sage-card',
    orbitSelector: '.mobile-sync-system .sync-orbit',
    targetSelector: '.mobile-phone-zone .simple-sync-phone',
    svgSelector: '.sync-journey--mobile',
    pathId: 'syncJourneyMobilePath',
    vertical: true
  });
})();

/* ==========================================================================
   Sync orbit heartbeat and collision-free product scatter v20
   ========================================================================== */
(() => {
  const orbits = document.querySelectorAll('.sync-orbit');
  const clouds = document.querySelectorAll('.promo-product-cloud');
  if (!orbits.length) return;

  /*
   * Twenty-one evenly spaced desktop slots. Products change slots on each
   * click, but the slot geometry remains collision-free in every layout.
   */
  const desktopSlots = [
    { x: 3,  y: 5 }, { x: 18, y: 3 }, { x: 33, y: 7 },
    { x: 48, y: 3 }, { x: 63, y: 8 }, { x: 78, y: 4 },
    { x: 91, y: 9 },

    { x: 2,  y: 42 }, { x: 17, y: 38 }, { x: 32, y: 46 },
    { x: 47, y: 39 }, { x: 62, y: 46 }, { x: 77, y: 38 },
    { x: 91, y: 44 },

    { x: 4,  y: 80 }, { x: 19, y: 75 }, { x: 34, y: 82 },
    { x: 49, y: 76 }, { x: 64, y: 82 }, { x: 79, y: 75 },
    { x: 91, y: 81 }
  ];

  const arrangeDesktopProducts = (layout, layoutIndex) => {
    const products = [
      ...layout.querySelectorAll('.promo-product-cloud--desktop .promo-product')
    ];

    products.forEach((product, productIndex) => {
      /* Multiplication by eight creates a complete, repeat-free permutation. */
      const slotIndex = (productIndex * 8 + layoutIndex * 5) % desktopSlots.length;
      const slot = desktopSlots[slotIndex];
      const size = 44 + ((productIndex + layoutIndex * 2) % 4) * 3;
      const rotation = ((productIndex * 17 + layoutIndex * 29) % 25) - 12;

      product.style.setProperty('left', `${slot.x}%`, 'important');
      product.style.setProperty('top', `${slot.y}%`, 'important');
      product.style.setProperty('right', 'auto', 'important');
      product.style.setProperty('bottom', 'auto', 'important');
      product.style.setProperty('width', `${size}px`, 'important');
      product.style.setProperty('height', `${size}px`, 'important');
      product.style.setProperty(
        'transform',
        `translate(-50%, -50%) rotate(${rotation}deg)`,
        'important'
      );
    });
  };

  const setCloudLayoutClass = (cloud, layoutIndex) => {
    cloud.classList.remove('scatter-layout-0', 'scatter-layout-1', 'scatter-layout-2');
    cloud.classList.add(`scatter-layout-${layoutIndex}`);
    cloud.dataset.scatterIndex = String(layoutIndex);
  };

  clouds.forEach((cloud) => setCloudLayoutClass(cloud, 0));
  document.querySelectorAll('.sync-desktop-layout').forEach((layout) => {
    arrangeDesktopProducts(layout, 0);
  });

  const beat = (orbit) => {
    orbit.classList.remove('is-beating');
    void orbit.offsetWidth;
    orbit.classList.add('is-beating');
    window.setTimeout(() => orbit.classList.remove('is-beating'), 1500);
  };

  const scatter = (orbit) => {
    const layout = orbit.closest('.sync-desktop-layout, .sync-mobile-layout');
    const layoutClouds = layout?.querySelectorAll('.promo-product-cloud');
    if (!layoutClouds?.length) return;

    const current = Number.parseInt(layoutClouds[0].dataset.scatterIndex || '0', 10);
    const next = (current + 1) % 3;

    layoutClouds.forEach((cloud) => {
      cloud.classList.remove('is-scattering');
      void cloud.offsetWidth;
      cloud.classList.add('is-scattering');
      setCloudLayoutClass(cloud, next);
      window.setTimeout(() => cloud.classList.remove('is-scattering'), 1250);
    });

    if (layout.classList.contains('sync-desktop-layout')) {
      arrangeDesktopProducts(layout, next);
    }
  };

  const activate = (orbit) => {
    beat(orbit);
    scatter(orbit);
  };

  orbits.forEach((orbit) => {
    orbit.setAttribute('role', 'button');
    orbit.setAttribute('tabindex', '0');
    orbit.setAttribute(
      'aria-label',
      'Pulse the data sync and rearrange the promotional products'
    );

    orbit.addEventListener('click', () => activate(orbit));
    orbit.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate(orbit);
      }
    });
  });
})();

/* ========================================================================== 
   Mobile and performance controller v17
   ========================================================================== */
(() => {
  const root = document.documentElement;
  const heroArt = document.querySelector('.hero-art');
  const saveData = Boolean(navigator.connection?.saveData);

  if (saveData) {
    root.classList.add('save-data');
  }

  if (heroArt && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        heroArt.classList.toggle('is-paused', !entry.isIntersecting);
      },
      { rootMargin: '180px 0px', threshold: 0.01 }
    );
    observer.observe(heroArt);
  }

  document.addEventListener('visibilitychange', () => {
    if (!heroArt) return;
    heroArt.classList.toggle('is-paused', document.hidden);
  });

  // Decode visible hero imagery early without blocking page interaction.
  const decodeVisibleHeroImages = () => {
    document
      .querySelectorAll('.hero img[loading="eager"]')
      .forEach((image) => image.decode?.().catch(() => {}));
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(decodeVisibleHeroImages, { timeout: 1200 });
  } else {
    window.setTimeout(decodeVisibleHeroImages, 250);
  }
})();
