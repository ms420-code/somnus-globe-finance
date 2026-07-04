/* ============================================================================
   SOMNUS — shared chrome injector (no-build). Renders nav + footer + favicon
   into every page so markup stays DRY. Set the current page with
   <body data-page="home|globe|markets|about">.
   Also exposes SOMNUS.toast() and SOMNUS.isSessionOpen() for all pages.
   ============================================================================ */
(function () {
  "use strict";

  const PAGES = [
    { id: "home",    href: "./index.html",   label: "Home" },
    { id: "globe",   href: "./globe.html",   label: "Globe" },
    { id: "markets", href: "./markets.html", label: "Markets" },
    { id: "about",   href: "./about.html",   label: "About" },
  ];

  const current = document.body.getAttribute("data-page") || "home";

  // ---- favicon: glowing globe dot (inline SVG data URI) ----
  const favSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<circle cx="16" cy="16" r="13" fill="#0C1A2C" stroke="#00FF88" stroke-width="2"/>' +
    '<ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="#00FF88" stroke-width="1.2" opacity="0.6"/>' +
    '<line x1="16" y1="3" x2="16" y2="29" stroke="#00FF88" stroke-width="1.2" opacity="0.6"/>' +
    '<circle cx="16" cy="16" r="3" fill="#00FF88"/></svg>';
  const fav = document.createElement("link");
  fav.rel = "icon";
  fav.href = "data:image/svg+xml," + encodeURIComponent(favSvg);
  document.head.appendChild(fav);

  // ---- nav ----
  function buildNav() {
    const nav = document.createElement("header");
    nav.className = "nav";
    const links = PAGES.map(function (p) {
      const active = p.id === current ? " active" : "";
      const cta = p.id === "globe" && current !== "globe" ? " cta" : "";
      return '<a href="' + p.href + '" class="' + (active + cta).trim() + '"' +
        (active ? ' aria-current="page"' : "") + ">" + p.label + "</a>";
    }).join("");
    nav.innerHTML =
      '<a class="wordmark" href="./index.html" aria-label="Somnus home">' +
      '<span class="dot"></span>SOMNUS</a>' +
      '<button class="nav-burger" aria-label="Toggle menu" aria-expanded="false">&#9776;</button>' +
      '<nav class="nav-links" aria-label="Primary">' + links + "</nav>";
    return nav;
  }

  // ---- footer ----
  function buildFooter() {
    const f = document.createElement("footer");
    f.className = "footer";
    const flinks = PAGES.map(function (p) {
      return '<a href="' + p.href + '">' + p.label + "</a>";
    }).join("");
    f.innerHTML =
      '<span class="wordmark">SOMNUS</span>' +
      '<div class="flinks">' + flinks + "</div>" +
      '<span class="disclaimer">Prototype — mock data</span>';
    return f;
  }

  function mount() {
    // the globe page has its own command-center topbar; skip the shared nav
    // there unless it explicitly opts in with a [data-nav] mount point.
    const navMount = document.querySelector("[data-nav]");
    if (navMount) navMount.replaceWith(buildNav());
    else if (current !== "globe") document.body.insertAdjacentElement("afterbegin", buildNav());

    const footMount = document.querySelector("[data-footer]");
    if (footMount) footMount.replaceWith(buildFooter());
    else if (current !== "globe") document.body.appendChild(buildFooter());

    // burger
    const burger = document.querySelector(".nav-burger");
    const links = document.querySelector(".nav-links");
    if (burger && links) {
      burger.addEventListener("click", function () {
        const open = links.classList.toggle("open");
        burger.setAttribute("aria-expanded", String(open));
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  // ---- shared helpers ----
  function toast(msg, isErr) {
    let host = document.getElementById("toasts");
    if (!host) {
      host = document.createElement("div");
      host.id = "toasts";
      document.body.appendChild(host);
    }
    const t = document.createElement("div");
    t.className = "toast" + (isErr ? " err" : "");
    t.setAttribute("role", "status");
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(function () {
      t.style.transition = "opacity .4s";
      t.style.opacity = "0";
      setTimeout(function () { t.remove(); }, 400);
    }, 3600);
  }

  function isSessionOpen(s) {
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: s.tz, hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
      }).formatToParts(now);
      const h = parseInt(parts.find(function (p) { return p.type === "hour"; }).value, 10);
      const m = parseInt(parts.find(function (p) { return p.type === "minute"; }).value, 10);
      const wd = parts.find(function (p) { return p.type === "weekday"; }).value;
      if (wd === "Sat" || wd === "Sun") return false;
      const t = h + m / 60;
      return t >= s.open && t <= s.close;
    } catch (e) { return false; }
  }

  window.SOMNUS = { toast: toast, isSessionOpen: isSessionOpen };
})();
