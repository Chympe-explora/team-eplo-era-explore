/**
 * motion.js — site-wide animation engine
 * ---------------------------------------------------------------------
 * One file, no build step, no libraries. Load it ONCE per page, just
 * BEFORE app.js:   <script src="motion.js?v=1" defer></script>
 *
 * It watches the page and animates things automatically as they appear,
 * so you never have to add animation code to app.js or config.js:
 *
 *   • Page opening   header drops in, then the first screen cascades in
 *                    (on the home page it waits for the intro video to finish)
 *   • Scrolling      thin green progress bar, gentle image parallax,
 *                    header firms up once you scroll
 *   • Every section  fades / rises into view the first time it's seen
 *   • Every text     headings wipe-and-rise, paragraphs / labels rise
 *   • Counters       plain numbers (50, 1,500, ₹2,000, 4.8, 10+) count up;
 *                    they also glide to the new number if it changes later
 *   • Buttons, links, cards, images, icons — pop / rise in, plus hover and
 *                    click effects (ripple, glow, tilt, image zoom, underline)
 *   • Transitions    switching pages inside the app fades the new page in;
 *                    modals / menus pop open; the "Know Before You Go"
 *                    style accordions open smoothly (newer browsers)
 *
 * Safe by design:
 *   • Respects "Reduce motion" (phone / computer accessibility setting):
 *     everything simply appears, nothing moves, counters show final values.
 *   • Only animates opacity / position / scale, which is GPU-friendly.
 *   • Never edits your classes or adds elements inside the app (the Content
 *     Editor in editor.js depends on that) — it only adds tiny data- tags.
 *   • If anything ever goes wrong it switches itself off and the site shows
 *     normally.
 *
 * ✏️  TO TUNE IT — edit the numbers in SETTINGS below (plain English).
 *     You can also override any of them from config.js or index.html with:
 *         window.KC_MOTION = { speed: 1.3, parallax: false };
 *     (put that line BEFORE the motion.js script tag).
 *
 * To skip one element:        add  data-mo-off  to it (no animation).
 * To count a number up:       <span data-count="1200" data-count-suffix="+">
 */
(function () {
  "use strict";
  if (window.__kcMotion) return;
  window.__kcMotion = true;

  /* =====================================================================
     1. SETTINGS — change these freely
     ===================================================================== */
  var SETTINGS = {
    enabled: true,          // false = turn ALL animation off
    speed: 1,               // 1 = normal · 1.5 = faster · 0.7 = slower
    distance: 28,           // how far (px) big things slide up from
    stagger: 70,            // ms between items that appear together
    maxSteps: 9,            // longest cascade = maxSteps × stagger

    pageLoad: true,         // header drop-in + background fade at opening
    scrollProgress: true,   // thin progress bar at the very top
    parallax: true,         // images drift slightly while scrolling
    counters: true,         // numbers count up
    cardGlow: true,         // soft light follows the mouse over cards
    cardTilt: true,         // small cards tilt toward the mouse (desktop)
    clickRipple: true       // ripple on buttons when pressed
  };

  var CFG = {};
  var k;
  for (k in SETTINGS) CFG[k] = SETTINGS[k];

  /* Older / low-power phones: keep the reveals, drop the heavy extras.
     (Your own window.KC_MOTION settings, applied next, always win.) */
  try {
    var weak = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
               (navigator.deviceMemory && navigator.deviceMemory <= 2);
    if (weak) { CFG.parallax = false; CFG.cardTilt = false; CFG.cardGlow = false; }
  } catch (e) {}

  if (window.KC_MOTION && typeof window.KC_MOTION === "object") {
    for (k in window.KC_MOTION) CFG[k] = window.KC_MOTION[k];
  }
  if (!CFG.enabled) return;

  var doc = document;
  var html = doc.documentElement;
  var rmq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  function reduced() { return !!rmq.matches; }

  var canObserve = ("IntersectionObserver" in window) && ("MutationObserver" in window);
  var finePointer = !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);

  /* =====================================================================
     2. THE CSS (injected once). Everything is switched on by the
        data-mo-on flag on <html>, so removing that flag = site is plain.
     ===================================================================== */
  function buildCSS() {
    var t = 1 / (CFG.speed > 0 ? CFG.speed : 1);
    var c = [];
    c.push(":root{--mo-ease:cubic-bezier(.22,1,.36,1);--mo-dist:" + CFG.distance + "px;--mo-t:" + t.toFixed(3) + ";--mo-stagger:" + CFG.stagger + "ms}");
    c.push("@media (max-width:640px){:root{--mo-dist:" + Math.round(CFG.distance * 0.7) + "px}}");

    /* hidden until revealed (JS sets data-mo-s=p only after it's running) */
    c.push("html[data-mo-on] [data-mo-s='p']{opacity:0!important}");

    /* the reveal itself: a keyframe animation that ends exactly on the
       element's normal look, so nothing lingers once it's done */
    c.push("html[data-mo-on] [data-mo-s='r']{animation-duration:calc(700ms*var(--mo-t));animation-timing-function:var(--mo-ease);animation-fill-mode:backwards;animation-delay:0ms}");
    var kinds = {
      "down":     ["mo-down", 800],
      "title":    ["mo-title", 850],
      "title-lg": ["mo-title", 1050],
      "text":     ["mo-rise", 650],
      "row":      ["mo-rise", 600],
      "card":     ["mo-card", 800],
      "img":      ["mo-img", 1000],
      "fade":     ["mo-fade", 900],
      "icon":     ["mo-icon", 650],
      "btn":      ["mo-btn", 650],
      "line":     ["mo-line", 800],
      "page":     ["mo-page", 560],
      "pop":      ["mo-pop", 340],
      "overlay":  ["mo-fade", 260]
    };
    for (var kind in kinds) {
      c.push("html[data-mo-on] [data-mo-s='r'][data-mo='" + kind + "']{animation-name:" + kinds[kind][0] + ";animation-duration:calc(" + kinds[kind][1] + "ms*var(--mo-t))}");
    }
    c.push("html[data-mo-on] [data-mo-s='r'][data-mo='icon']{animation-timing-function:cubic-bezier(.34,1.56,.64,1)}");
    c.push("[data-mo='line']{transform-origin:left center}");
    for (var i = 0; i <= 40; i++) {
      c.push("html[data-mo-on] [data-mo-s='r'][data-mo-i='" + i + "']{animation-delay:calc(" + i + "*var(--mo-stagger)*var(--mo-t))}");
    }
    /* only a "from" frame — the browser animates to the element's own look */
    c.push("@keyframes mo-down{from{opacity:0;translate:0 -26px}}");
    c.push("@keyframes mo-title{from{opacity:0;translate:0 .45em;clip-path:inset(0 0 100% 0)}to{clip-path:inset(-25% -10% -35% -10%)}}");
    c.push("@keyframes mo-rise{from{opacity:0;translate:0 14px}}");
    c.push("@keyframes mo-card{from{opacity:0;translate:0 var(--mo-dist);scale:.965}}");
    c.push("@keyframes mo-img{from{opacity:0;scale:1.08}}");
    c.push("@keyframes mo-fade{from{opacity:0}}");
    c.push("@keyframes mo-icon{from{opacity:0;scale:.4;rotate:-18deg}}");
    c.push("@keyframes mo-btn{from{opacity:0;translate:0 12px;scale:.94}}");
    c.push("@keyframes mo-line{from{opacity:0;scale:0 1}}");
    c.push("@keyframes mo-page{from{opacity:0;translate:0 18px}}");
    c.push("@keyframes mo-pop{from{opacity:0;scale:.94;translate:0 8px}}");

    /* page opening: background + chat bubble */
    if (CFG.pageLoad) {
      c.push("html[data-mo-on]:not([data-mo-go]) #kc-bg-layer{opacity:0}");
      c.push("html[data-mo-on][data-mo-go] #kc-bg-layer{animation:mo-bg calc(1800ms*var(--mo-t)) var(--mo-ease) backwards}");
      c.push("@keyframes mo-bg{from{opacity:0;scale:1.07}}");
      c.push("html[data-mo-on]:not([data-mo-go]) #era-ai-bubble{opacity:0}");
      c.push("html[data-mo-on][data-mo-go] #era-ai-bubble{animation:mo-bubble calc(700ms*var(--mo-t)) cubic-bezier(.34,1.56,.64,1) calc(1400ms*var(--mo-t)) backwards}");
      c.push("@keyframes mo-bubble{from{opacity:0;scale:.3}}");
    }

    /* scroll: progress bar + header that firms up */
    c.push("#kc-mo-progress{position:fixed;top:0;left:0;right:0;height:3px;z-index:2147483000;pointer-events:none;transform-origin:0 50%;transform:scaleX(0);background:linear-gradient(90deg,#2E8B57,#34d399 60%,#a7f3d0);box-shadow:0 0 10px rgba(52,211,153,.55);opacity:0;transition:opacity .3s ease}");
    c.push("html[data-mo-scrolled] #kc-mo-progress{opacity:1}");
    c.push("html[data-mo-on] .kc-header-3d{transition:background-color .45s ease,box-shadow .45s ease}");
    c.push("html[data-mo-on][data-mo-scrolled] .kc-header-3d{background:rgba(255,255,255,.14)!important}");

    /* parallax images are drawn slightly oversize so they never show gaps */
    c.push("html[data-mo-on] img[data-mo-px]{scale:1.12}");

    /* clicking: ripple + press */
    c.push("@property --mo-r{syntax:'<length>';inherits:false;initial-value:0px}");
    c.push("[data-mo-rel]{position:relative}");
    c.push("[data-mo-rip]::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(circle at var(--mo-x,50%) var(--mo-y,50%),rgba(255,255,255,.42) 0,rgba(255,255,255,.2) var(--mo-r),transparent calc(var(--mo-r) + 1px));animation:mo-ripple .65s ease-out forwards}");
    c.push("@keyframes mo-ripple{from{--mo-r:0px;opacity:1}to{--mo-r:var(--mo-rmax,240px);opacity:0}}");
    c.push("html[data-mo-on] [data-mo='card'][role='button']:active,html[data-mo-on] [id^='dest-']:active{scale:.985}");

    /* hover effects only for real mice — never for touch */
    c.push("@media (hover:hover) and (pointer:fine){");
    c.push("[data-mo='card']::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .4s ease;background:radial-gradient(380px circle at var(--mo-mx,50%) var(--mo-my,50%),rgba(255,255,255,.10),transparent 62%)}");
    c.push("[data-mo='card'][data-mo-hover]::after{opacity:1}");
    c.push("[data-mo-persp]{perspective:1100px}");
    c.push("html[data-mo-on] img[data-mo-zoom]{transition:scale .8s var(--mo-ease)}");
    c.push("html[data-mo-on] [data-mo-zoomwrap]:hover>img[data-mo-zoom]{scale:1.07}");
    c.push("html[data-mo-on] :is(button,a,summary,[role='button']) svg{transition:scale .3s var(--mo-ease),rotate .3s var(--mo-ease)}");
    c.push("html[data-mo-on] :is(button,a,summary,[role='button']):hover svg{scale:1.12;rotate:-5deg}");
    c.push("}");

    /* links in running text: underline that draws in */
    c.push("html[data-mo-on] a[data-mo-link]{background-image:linear-gradient(currentColor,currentColor);background-repeat:no-repeat;background-position:0 100%;background-size:0 1px;transition:background-size .4s var(--mo-ease),color .2s ease,opacity .2s ease}");
    c.push("html[data-mo-on] a[data-mo-link]:hover,html[data-mo-on] a[data-mo-link]:focus-visible{background-size:100% 1px}");

    /* form fields: the focus ring fades in instead of snapping */
    c.push("html[data-mo-on] input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']),html[data-mo-on] textarea,html[data-mo-on] select{transition:border-color .3s ease,outline-color .3s ease,background-color .3s ease}");
    c.push("html[data-mo-on] input:focus,html[data-mo-on] textarea:focus,html[data-mo-on] select:focus{outline-color:rgba(52,211,153,.45)}");

    /* tap-to-expand sections (<details>) open smoothly where supported */
    c.push("@supports (interpolate-size:allow-keywords){html[data-mo-on]{interpolate-size:allow-keywords}html[data-mo-on] details::details-content{block-size:0;overflow:hidden;transition:block-size .5s var(--mo-ease),content-visibility .5s allow-discrete}html[data-mo-on] details[open]::details-content{block-size:auto}}");
    c.push("html[data-mo-on] details>summary svg{transition:transform .4s var(--mo-ease)}");

    /* never hide content on paper */
    c.push("@media print{[data-mo-s]{opacity:1!important;animation:none!important}}");

    /* Reduce motion: no movement anywhere, content just appears */
    c.push("@media (prefers-reduced-motion:reduce){html[data-mo-on] [data-mo-s]{opacity:1!important;animation:none!important}html[data-mo-on] img[data-mo-px]{scale:1}*,*::before,*::after{animation-duration:.001ms!important;animation-delay:0ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;transition-delay:0ms!important;scroll-behavior:auto!important}}");
    return c.join("\n");
  }

  var styleEl = doc.createElement("style");
  styleEl.id = "kc-motion-css";
  styleEl.textContent = buildCSS();
  (doc.head || html).appendChild(styleEl);

  /* =====================================================================
     3. STATE + SMALL HELPERS
     ===================================================================== */
  var rootEl = null;
  var seen = (typeof WeakSet !== "undefined") ? new WeakSet() : { has: function () { return false; }, add: function () {} };
  var observed = [];            // elements waiting to be revealed
  var gate = false;             // false while the intro video is still playing
  var held = [];                // elements that became visible while gate was closed
  var churn = (typeof WeakMap !== "undefined") ? new WeakMap() : null;
  var broken = false;
  var io = null, mo = null, ioPx = null;
  var pxActive = [];
  var counters = (typeof WeakMap !== "undefined") ? new WeakMap() : null; // element -> counter record

  function clsOf(el) {
    var c = el.getAttribute && el.getAttribute("class");
    return c || "";
  }
  function hasClass(el, name) {
    return el.classList ? el.classList.contains(name) : (" " + clsOf(el) + " ").indexOf(" " + name + " ") > -1;
  }
  function hasDirectText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true;
    }
    return false;
  }
  function typingNow() {
    var a = doc.activeElement;
    return !!(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable));
  }
  function failSafe(err) {
    /* Anything unexpected: show the site normally, stop animating. */
    broken = true;
    try { html.removeAttribute("data-mo-on"); } catch (e) {}
    try { if (io) io.disconnect(); if (mo) mo.disconnect(); if (ioPx) ioPx.disconnect(); } catch (e) {}
    try { if (window.console) console.warn("[motion.js] switched off:", err); } catch (e) {}
  }

  /* =====================================================================
     4. WHAT GETS WHICH ANIMATION
     ===================================================================== */
  var SKIP_TAGS = {
    script: 1, style: 1, link: 1, meta: 1, noscript: 1, br: 1, template: 1,
    option: 1, optgroup: 1, source: 1, track: 1, video: 1, canvas: 1, iframe: 1,
    audio: 1, picture: 0, head: 1, path: 1, circle: 1, line: 1, rect: 1,
    polyline: 1, polygon: 1, ellipse: 1, g: 1, defs: 1, use: 1, text: 1, tspan: 1,
    clippath: 1, mask: 1, lineargradient: 1, radialgradient: 1, stop: 1
  };

  var COUNT_RE = /^(\s*)([₹$€£]?\s?)(\d{1,3}(?:,\d{2,3})+|\d+)(\.\d+)?(\s?(?:%|\+|[kKmM]\+?))?(\s*)$/;
  function parseCount(text) {
    var m = COUNT_RE.exec(text);
    if (!m) return null;
    var intPart = m[3], dec = m[4] || "", digits = intPart.replace(/,/g, "");
    if (digits.length > 8) return null;                       // phone numbers etc.
    var lead = m[1] + m[2], trail = (m[5] || "") + (m[6] || "");
    var val = parseFloat(digits + dec);
    if (!lead.trim() && !m[5] && !dec && digits.length === 4 && val >= 1900 && val <= 2100) return null; // a year
    if (!dec && !(val >= 10)) return null;                    // 1, 2, 3 (step numbers)
    if (dec && !(val > 0)) return null;
    return {
      lead: lead, trail: trail, val: val, dec: dec ? dec.length - 1 : 0,
      grouped: intPart.indexOf(",") > -1,
      indian: /^\d{1,2}(,\d{2})+,\d{3}$/.test(intPart)
    };
  }

  /* returns an animation name for an element, or null for "leave it alone" */
  function classify(el, insideText) {
    var tag = el.localName;
    var cls = clsOf(el);
    if (cls.indexOf("animate-") > -1) return null;            // already has its own animation
    if (el.hasAttribute("data-mo-off")) return null;
    if (insideText) {
      return null;                                            // part of a bigger text/button block
    }
    if (tag === "main" || el.hasAttribute("data-kc-page")) return "page";
    if (tag === "header" || cls.indexOf("kc-header-3d") > -1) {
      var hp = el.parentElement;
      if (hp && hp.getAttribute && hp.getAttribute("data-mo") === "down") return null;   // the wrapper already drops in
      return "down";
    }
    if (tag === "footer" || tag === "section") return "fade";

    /* modals, lightboxes, drop-down panels */
    if (hasClass(el, "fixed") && hasClass(el, "inset-0")) return "overlay";
    var par = el.parentElement;
    var parKind = par && par.getAttribute && par.getAttribute("data-mo");
    var isCard = cls.indexOf("backdrop-blur") > -1 && cls.indexOf("rounded-") > -1;
    if (parKind === "overlay" && (isCard || /rounded-/.test(cls) || tag === "div")) return "pop";
    if (isCard || (el.id && el.id.indexOf("dest-") === 0)) {
      if (hasClass(el, "absolute") || hasClass(el, "fixed")) return "pop";
      return "card";
    }

    if (tag === "h1") return "title-lg";
    if (tag === "h2" || tag === "h3") return "title";
    if (tag === "h4" || tag === "h5" || tag === "h6") return "text";

    if (tag === "img") {
      if (par && /transition-transform/.test(clsOf(par))) return null;   // slideshow strip
      return "img";
    }
    if (tag === "svg") {
      var w = parseInt(el.getAttribute("width"), 10);
      return (w && w > 64) ? "fade" : "icon";
    }
    if (tag === "hr" || cls.indexOf("h-px") > -1) return "line";

    if (tag === "button" || tag === "a" || el.getAttribute("role") === "button") {
      var rich = el.children.length > 3 || (el.querySelector && el.querySelector("img,h1,h2,h3,h4,p"));
      return rich ? "row" : "btn";
    }
    if (tag === "input" || tag === "textarea" || tag === "select") {
      var ty = (el.getAttribute("type") || "").toLowerCase();
      if (ty === "hidden") return null;
      return "text";
    }
    /* panels with a border + soft background (rows, steppers, option boxes) */
    if (/rounded-/.test(cls) && /(^|\s)border(\s|$)/.test(cls) && /bg-(white|black)/.test(cls)) return "row";
    if (hasDirectText(el) || el.hasAttribute("data-count")) return "text";
    return null;
  }

  function register(el, kind) {
    if (seen.has(el)) return;
    seen.add(el);
    el.setAttribute("data-mo", kind);
    el.setAttribute("data-mo-s", "p");

    var tag = el.localName;
    /* number that should count up? */
    if (CFG.counters && kind === "text" && !el.hasAttribute("data-mo-nocount")) {
      var rec = null;
      if (el.hasAttribute("data-count")) {
        var raw = el.getAttribute("data-count");
        var sfx = el.getAttribute("data-count-suffix") || "";
        var pfx = el.getAttribute("data-count-prefix") || "";
        rec = parseCount(pfx + raw + sfx);
        if (!rec) { var v = parseFloat(raw); if (v === v) rec = { lead: pfx, trail: sfx, val: v, dec: (String(raw).split(".")[1] || "").length, grouped: v >= 1000, indian: false }; }
      } else if (el.children.length === 0 && el.childNodes.length === 1 && el.firstChild.nodeType === 3 && el.firstChild.nodeValue.length <= 16) {
        if (!el.closest("input,textarea,select,form,[contenteditable]")) rec = parseCount(el.firstChild.nodeValue);
      }
      if (rec && el.firstChild && el.firstChild.nodeType === 3) {
        rec.node = el.firstChild;
        rec.final = el.firstChild.nodeValue;
        rec.last = rec.final;
        rec.cur = rec.val;
        rec.raf = 0;
        rec.started = false;
        if (counters) counters.set(el, rec);
        el.setAttribute("data-mo-count", "");
      }
    }

    /* image extras: parallax inside tall frames, hover zoom inside small ones */
    if (kind === "img") {
      var wrap = el.parentElement;
      var wcls = wrap ? clsOf(wrap) : "";
      if (wrap && wcls.indexOf("overflow-hidden") > -1 && clsOf(el).indexOf("group-hover:") === -1 && !wrap.closest("button,[role='button']")) {
        if (CFG.parallax && clsOf(el).indexOf("object-cover") > -1 && /(^|\s)(h-\[?\d|aspect-\[)/.test(wcls) && wcls.indexOf("aspect-square") === -1) {
          el.setAttribute("data-mo-px", "");
          el.setAttribute("data-mo", "fade");               // parallax images only fade in
          if (ioPx) ioPx.observe(el);
        } else {
          el.setAttribute("data-mo-zoom", "");
          wrap.setAttribute("data-mo-zoomwrap", "");
        }
      } else if (wrap && wcls.indexOf("overflow-hidden") > -1 && /group-hover:/.test(clsOf(el)) && CFG.parallax &&
                 /(^|\s)(h-\[?\d|aspect-\[)/.test(wcls)) {
        el.setAttribute("data-mo-px", "");
        if (ioPx) ioPx.observe(el);
      }
    }
    /* text links get the drawing underline */
    if (tag === "a" && kind === "btn" && !/(^|\s)(inline-flex|flex|block|grid)(\s|$)/.test(clsOf(el)) &&
        !/bg-|rounded|border/.test(clsOf(el)) && el.getAttribute("href")) {
      el.setAttribute("data-mo-link", "");
    }

    if (observed.length > 4000) pruneObserved();
    observed.push(el);
    io.observe(el);
  }

  function pruneObserved() {
    var keep = [];
    for (var i = 0; i < observed.length; i++) {
      var e = observed[i];
      if (e.isConnected && e.getAttribute("data-mo-s") === "p") keep.push(e);
    }
    observed = keep;
  }

  /* Reveal anything pending that is on screen but sits where the observer
     can't see it (the last few pixels of a short page, the very bottom). */
  function sweepVisible() {
    if (broken || !gate) return;
    pruneObserved();
    var vh = window.innerHeight, rects = [], i;
    for (i = 0; i < observed.length; i++) rects.push(observed[i].getBoundingClientRect());
    var hit = [], past = [];
    for (i = 0; i < observed.length; i++) {
      var r = rects[i];
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh) hit.push(observed[i]);
      else if (r.height > 0 && r.bottom <= 0) past.push(observed[i]);     // already scrolled past
    }
    for (i = 0; i < past.length; i++) { io.unobserve(past[i]); settle(past[i]); }
    if (hit.length) { for (i = 0; i < hit.length; i++) io.unobserve(hit[i]); reveal(hit); }
  }
  var sweepTimer = 0;
  function sweepSoon() { clearTimeout(sweepTimer); sweepTimer = setTimeout(sweepVisible, 220); }

  /* walk a freshly-added piece of the page and register what animates */
  function walk(el, insideText, depth) {
    if (!el || el.nodeType !== 1 || depth > 80) return;
    var tag = el.localName;
    if (SKIP_TAGS[tag]) return;
    if (el.id === "kc-intro-overlay" || el.hasAttribute("data-mo-skip")) return;
    var cls = clsOf(el);
    if (cls.indexOf("maplibregl") > -1 || cls.indexOf("mapboxgl") > -1) return;   // map internals
    var kind = classify(el, insideText);
    if (kind) register(el, kind);
    if (tag === "svg") return;
    var inner = insideText || kind === "text" || kind === "title" || kind === "title-lg" || kind === "btn";
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) walk(c, inner, depth + 1);
  }

  /* =====================================================================
     5. REVEALING (one cascade per batch of things that arrive together)
     ===================================================================== */
  function byDocOrder(a, b) {
    if (a === b) return 0;
    return (a.compareDocumentPosition(b) & 4) ? -1 : 1;
  }

  function reveal(list) {
    var live = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.isConnected && el.getAttribute("data-mo-s") === "p") live.push(el);
    }
    if (!live.length) return;
    live.sort(byDocOrder);
    var total = live.length, max = CFG.maxSteps;
    for (var n = 0; n < total; n++) {
      var step = total <= max ? n : Math.floor(n * max / total);
      var el2 = live[n];
      el2.setAttribute("data-mo-i", String(Math.min(step, 40)));
      el2.setAttribute("data-mo-s", "r");
      if (el2.hasAttribute("data-mo-count")) startCounter(el2, step * CFG.stagger / Math.max(CFG.speed, 0.1));
    }
  }

  /* show an element in its normal state immediately, no animation */
  function settle(el) {
    if (!el || !el.isConnected) return;
    var rec = counters && counters.get(el);
    if (rec && !rec.started) { rec.started = true; rec.cur = rec.val; if (rec.node) writeCount(rec, rec.final); }
    el.removeAttribute("data-mo-s");
    el.removeAttribute("data-mo-i");
  }

  function onIntersect(entries) {
    if (broken) return;
    try {
      var batch = [];
      for (var i = 0; i < entries.length; i++) {
        var en = entries[i];
        if (en.isIntersecting) {
          io.unobserve(en.target);
          batch.push(en.target);
        } else if (en.boundingClientRect && en.boundingClientRect.bottom <= 0) {
          /* flicked past (or added above the screen): nobody saw it arrive,
             so skip the animation and just show it normally */
          io.unobserve(en.target);
          settle(en.target);
        }
      }
      if (!batch.length) return;
      if (!gate) { held = held.concat(batch); return; }
      reveal(batch);
    } catch (e) { failSafe(e); }
  }

  /* an animation finished: hand the element back, untouched */
  doc.addEventListener("animationend", function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    if (e.animationName === "mo-ripple") { t.removeAttribute("data-mo-rip"); return; }
    if (t.getAttribute("data-mo-s") === "r" && /^mo-/.test(e.animationName || "")) {
      t.removeAttribute("data-mo-s");
      t.removeAttribute("data-mo-i");
    }
  }, true);

  /* =====================================================================
     6. COUNTERS
     ===================================================================== */
  var fmtCache = {};
  function fmtCount(rec, v) {
    var key = (rec.indian ? "i" : "u") + (rec.grouped ? "g" : "n") + rec.dec;
    var f = fmtCache[key];
    if (!f) {
      try {
        f = fmtCache[key] = new Intl.NumberFormat(rec.indian ? "en-IN" : "en-US",
          { minimumFractionDigits: rec.dec, maximumFractionDigits: rec.dec, useGrouping: rec.grouped });
      } catch (e) { f = fmtCache[key] = { format: function (x) { return x.toFixed(rec.dec); } }; }
    }
    return rec.lead + f.format(v) + rec.trail;
  }

  function writeCount(rec, text) {
    if (!rec.node || !rec.node.parentNode) return false;
    rec.last = text;
    rec.node.nodeValue = text;
    return true;
  }

  function tween(rec, from, to, dur, delay) {
    if (rec.raf) { cancelAnimationFrame(rec.raf); rec.raf = 0; }
    if (reduced() || !(dur > 0)) { rec.cur = to; writeCount(rec, rec.final); return; }
    var t0 = 0;
    writeCount(rec, fmtCount(rec, from));
    function step(ts) {
      if (!t0) t0 = ts + delay;
      var p = (ts - t0) / dur;
      if (p < 0) { rec.raf = requestAnimationFrame(step); return; }
      if (p >= 1 || reduced()) {
        rec.cur = to; rec.raf = 0;
        writeCount(rec, rec.final);                         // exactly the text React rendered
        return;
      }
      var e = 1 - Math.pow(2, -10 * p);                     // easeOutExpo
      rec.cur = from + (to - from) * e;
      if (!writeCount(rec, fmtCount(rec, rec.cur))) { rec.raf = 0; return; }
      rec.raf = requestAnimationFrame(step);
    }
    rec.raf = requestAnimationFrame(step);
  }

  function startCounter(el, delay) {
    var rec = counters && counters.get(el);
    if (!rec || rec.started) return;
    rec.started = true;
    if (reduced()) return;
    var dur = Math.min(2200, 1100 + Math.log10(Math.max(rec.val, 10)) * 220) / Math.max(CFG.speed, 0.1);
    tween(rec, 0, rec.val, dur, delay);
  }

  /* if React later changes a counted number, glide to the new one */
  function onTextChanged(el) {
    var rec = counters && counters.get(el);
    if (!rec || !rec.started) return;
    var node = el.firstChild;
    if (!node || node.nodeType !== 3) return;
    if (node === rec.node && node.nodeValue === rec.last) return;       // that was our own write
    var parsed = parseCount(node.nodeValue);
    rec.node = node;
    rec.final = node.nodeValue;
    if (!parsed) { if (rec.raf) { cancelAnimationFrame(rec.raf); rec.raf = 0; } rec.last = node.nodeValue; return; }
    rec.lead = parsed.lead; rec.trail = parsed.trail; rec.dec = parsed.dec; rec.grouped = parsed.grouped; rec.indian = parsed.indian;
    var from = rec.cur;
    rec.val = parsed.val;
    var r = el.getBoundingClientRect();
    var onScreen = r.bottom > 0 && r.top < window.innerHeight;
    if (!onScreen || reduced()) { rec.cur = parsed.val; rec.last = node.nodeValue; return; }
    tween(rec, from, parsed.val, 650, 0);
  }

  /* =====================================================================
     7. WATCHING THE PAGE FOR NEW CONTENT
     ===================================================================== */
  function onMutate(records) {
    if (broken) return;
    try {
      var roots = [];
      var now = Date.now();
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === "characterData") {
          var pe = r.target.parentNode;
          if (pe && pe.nodeType === 1 && pe.hasAttribute && pe.hasAttribute("data-mo-count")) onTextChanged(pe);
          continue;
        }
        if (r.target && r.target.nodeType === 1 && r.target.hasAttribute && r.target.hasAttribute("data-mo-count")) onTextChanged(r.target);
        for (var j = 0; j < r.addedNodes.length; j++) {
          var n = r.addedNodes[j];
          if (n.nodeType === 1 && n.isConnected) roots.push(n);
        }
      }
      if (!roots.length) return;
      if (typingNow() || doc.hidden) { return; }            // someone is typing: never flicker their form

      var judged = [];                                      // parents already counted in THIS callback
      for (var k2 = 0; k2 < roots.length; k2++) {
        var node = roots[k2];
        if (seen.has(node)) continue;
        /* a region that keeps re-creating itself (timers, live updates): leave it alone */
        var p = node.parentElement, skip = false;
        if (p && churn) {
          var found = null;
          for (var q = 0; q < judged.length; q++) if (judged[q].p === p) { found = judged[q]; break; }
          if (!found) {
            var hits = (churn.get(p) || []).filter(function (t) { return now - t < 3500; });
            hits.push(now);
            churn.set(p, hits);
            found = { p: p, skip: hits.length >= 3 };
            judged.push(found);
          }
          skip = found.skip;
        }
        if (!skip) walk(node, false, 0);
      }
    } catch (e) { failSafe(e); }
  }

  /* =====================================================================
     8. SCROLL: progress bar, header, parallax
     ===================================================================== */
  var progressEl = null, rafScroll = 0;

  function onPxIntersect(entries) {
    for (var i = 0; i < entries.length; i++) {
      var el = entries[i].target, idx = pxActive.indexOf(el);
      if (entries[i].isIntersecting) {
        var ph = el.parentElement ? el.parentElement.clientHeight : 0;
        if (ph && ph < 140) {                                // too small to bother: hover zoom instead
          el.removeAttribute("data-mo-px");
          el.setAttribute("data-mo-zoom", "");
          if (el.parentElement) el.parentElement.setAttribute("data-mo-zoomwrap", "");
          ioPx.unobserve(el);
          continue;
        }
        if (idx < 0) pxActive.push(el);
      } else if (idx > -1) {
        pxActive.splice(idx, 1);
      }
    }
    queueScroll();
  }

  function queueScroll() { if (!rafScroll) rafScroll = requestAnimationFrame(scrollFrame); }

  function scrollFrame() {
    rafScroll = 0;
    if (broken) return;
    var y = window.pageYOffset || html.scrollTop || 0;
    var vh = window.innerHeight || 1;
    if (progressEl && CFG.scrollProgress) {
      var max = Math.max(1, html.scrollHeight - vh);
      progressEl.style.transform = "scaleX(" + Math.min(1, Math.max(0, y / max)).toFixed(4) + ")";
    }
    if (y + vh >= html.scrollHeight - 4) sweepVisible();   // reached the bottom of the page
    sweepSoon();                                           // …and shortly after any scrolling stops
    if (y > 14) { if (!html.hasAttribute("data-mo-scrolled")) html.setAttribute("data-mo-scrolled", ""); }
    else if (html.hasAttribute("data-mo-scrolled")) html.removeAttribute("data-mo-scrolled");

    if (CFG.parallax && !reduced() && pxActive.length) {
      var rects = [], i;
      for (i = 0; i < pxActive.length; i++) rects.push(pxActive[i].parentElement.getBoundingClientRect());   // read…
      for (i = 0; i < pxActive.length; i++) {                                                                  // …then write
        var rc = rects[i];
        var prog = ((rc.top + rc.height / 2) - vh / 2) / (vh / 2 + rc.height / 2);
        prog = Math.max(-1, Math.min(1, prog));
        pxActive[i].style.translate = "0 " + (-prog * rc.height * 0.05).toFixed(1) + "px";
      }
    }
  }

  /* =====================================================================
     9. HOVER + CLICK (mouse: glow + tilt · everyone: ripple)
     ===================================================================== */
  var hoverCard = null, lastEvt = null, rafMove = 0;
  var tiltOK = (typeof WeakMap !== "undefined") ? new WeakMap() : null;
  var tilt = { el: null, cx: 0, cy: 0, tx: 0, ty: 0, raf: 0 };

  function ensureRel(el) {
    if (el.hasAttribute("data-mo-rel")) return;
    try { if (window.getComputedStyle(el).position === "static") el.setAttribute("data-mo-rel", ""); } catch (e) {}
  }

  function tiltTick() {
    tilt.cx += (tilt.tx - tilt.cx) * 0.14;
    tilt.cy += (tilt.ty - tilt.cy) * 0.14;
    var el = tilt.el;
    if (!el) { tilt.raf = 0; return; }
    var mag = Math.sqrt(tilt.cx * tilt.cx + tilt.cy * tilt.cy);
    if (mag < 0.004 && tilt.tx === 0 && tilt.ty === 0) {
      el.style.rotate = "";
      tilt.el = null; tilt.raf = 0;
      return;
    }
    el.style.rotate = (-tilt.cy).toFixed(3) + " " + tilt.cx.toFixed(3) + " 0 " + (mag * 4.5).toFixed(2) + "deg";
    tilt.raf = requestAnimationFrame(tiltTick);
  }

  function cardTiltAllowed(card) {
    if (!CFG.cardTilt || reduced()) return false;
    var ok = tiltOK && tiltOK.get(card);
    if (ok !== undefined && ok !== null) return ok;
    var r = card.getBoundingClientRect();
    ok = r.width <= 560 && r.height <= 560 && !card.querySelector("input,textarea,select,video,[contenteditable]");
    if (tiltOK) tiltOK.set(card, ok);
    return ok;
  }

  function leaveCard(card) {
    if (!card) return;
    card.removeAttribute("data-mo-hover");
    if (tilt.el === card) {
      tilt.tx = 0; tilt.ty = 0;
      if (!tilt.raf) tilt.raf = requestAnimationFrame(tiltTick);
    }
    if (card.parentElement) card.parentElement.removeAttribute("data-mo-persp");
  }

  function moveFrame() {
    rafMove = 0;
    if (!lastEvt || reduced()) return;
    var t = lastEvt.target;
    var card = (t && t.closest) ? t.closest("[data-mo='card']") : null;
    if (card !== hoverCard) {
      leaveCard(hoverCard);
      hoverCard = card;
      if (card) {
        ensureRel(card);
        if (CFG.cardGlow) card.setAttribute("data-mo-hover", "");
        if (cardTiltAllowed(card)) {
          if (tilt.el && tilt.el !== card) { tilt.el.style.rotate = ""; }
          tilt.el = card; tilt.cx = 0; tilt.cy = 0;
          if (card.parentElement) card.parentElement.setAttribute("data-mo-persp", "");
        }
      }
    }
    if (card) {
      var r = card.getBoundingClientRect();
      var px = (lastEvt.clientX - r.left), py = (lastEvt.clientY - r.top);
      card.style.setProperty("--mo-mx", px.toFixed(0) + "px");
      card.style.setProperty("--mo-my", py.toFixed(0) + "px");
      if (tilt.el === card) {
        tilt.tx = Math.max(-1, Math.min(1, (px / r.width - 0.5) * 2));
        tilt.ty = Math.max(-1, Math.min(1, (py / r.height - 0.5) * 2));
        if (!tilt.raf) tilt.raf = requestAnimationFrame(tiltTick);
      }
    }
  }

  function onPointerMove(e) {
    if (e.pointerType && e.pointerType !== "mouse") return;
    lastEvt = e;
    if (!rafMove) rafMove = requestAnimationFrame(moveFrame);
  }

  function onPointerDown(e) {
    if (!CFG.clickRipple || reduced() || broken) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var b = t.closest("button,[role='button'],a[href],summary");
    if (!b || b.disabled || b.getAttribute("aria-disabled") === "true" || b.hasAttribute("data-mo-off")) return;
    if (b.localName === "a" && window.getComputedStyle(b).display === "inline") return;   // plain text link: no ripple
    ensureRel(b);
    var r = b.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    var far = Math.sqrt(Math.pow(Math.max(x, r.width - x), 2) + Math.pow(Math.max(y, r.height - y), 2));
    b.style.setProperty("--mo-x", x.toFixed(0) + "px");
    b.style.setProperty("--mo-y", y.toFixed(0) + "px");
    b.style.setProperty("--mo-rmax", Math.ceil(far) + "px");
    b.removeAttribute("data-mo-rip");
    void b.offsetWidth;                                     // restart the animation
    b.setAttribute("data-mo-rip", "");
  }

  /* =====================================================================
     10. START-UP
     ===================================================================== */
  function openGate() {
    if (gate || broken) return;
    gate = true;
    html.setAttribute("data-mo-go", "");
    var list = held; held = [];
    if (list.length) reveal(list);
    setTimeout(sweepVisible, 1400);
    setTimeout(sweepVisible, 3500);
  }

  function watchGate() {
    function ready() {
      var ov = doc.getElementById("kc-intro-overlay");
      return !ov || hasClass(ov, "kc-hide");
    }
    if (!CFG.pageLoad || ready()) { openGate(); return; }
    var ov = doc.getElementById("kc-intro-overlay");
    var go = new MutationObserver(function () {
      if (ready() || !doc.getElementById("kc-intro-overlay")) { go.disconnect(); setTimeout(openGate, 160); }
    });
    go.observe(ov, { attributes: true, attributeFilter: ["class"] });
    go.observe(doc.body, { childList: true });
    setTimeout(openGate, 11000);                            // never wait longer than the intro's own ceiling
  }

  function watchdog() {
    /* last line of defence: anything still hidden while on screen gets shown */
    setTimeout(function () {
      if (broken || !gate) return;
      var vh = window.innerHeight, stuck = [];
      for (var i = 0; i < observed.length; i++) {
        var el = observed[i];
        if (!el.isConnected) { observed.splice(i--, 1); continue; }
        if (el.getAttribute("data-mo-s") !== "p") { observed.splice(i--, 1); continue; }
        var r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh && r.width > 0) stuck.push(el);
      }
      if (stuck.length) { for (var j = 0; j < stuck.length; j++) io.unobserve(stuck[j]); reveal(stuck); }
      if (observed.length > 6000) observed.length = 0;
    }, 7000);
  }

  var started = false;
  function start() {
    if (started) return;
    rootEl = doc.getElementById("root");
    if (!rootEl || !canObserve) return;
    started = true;
    try {
      html.setAttribute("data-mo-on", "");

      if (CFG.scrollProgress) {
        progressEl = doc.createElement("div");
        progressEl.id = "kc-mo-progress";
        progressEl.setAttribute("aria-hidden", "true");
        doc.body.appendChild(progressEl);
      }

      io = new IntersectionObserver(onIntersect, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
      ioPx = new IntersectionObserver(onPxIntersect, { rootMargin: "120px 0px 120px 0px", threshold: 0 });
      mo = new MutationObserver(onMutate);
      mo.observe(rootEl, { childList: true, subtree: true, characterData: true });

      window.addEventListener("scroll", queueScroll, { passive: true });
      window.addEventListener("resize", queueScroll, { passive: true });
      doc.addEventListener("pointerdown", onPointerDown, { passive: true });
      if (finePointer) {
        doc.addEventListener("pointermove", onPointerMove, { passive: true });
        html.addEventListener("pointerleave", function () { leaveCard(hoverCard); hoverCard = null; }, { passive: true });
      }

      /* anything already on the page (if this script ever loads after the app) */
      var first = rootEl.firstElementChild;
      while (first) { walk(first, false, 0); first = first.nextElementSibling; }

      watchGate();
      watchdog();
      queueScroll();

      /* coming back with the browser's Back button: don't replay a stuck state */
      window.addEventListener("pageshow", function (e) { if (e.persisted) queueScroll(); });
    } catch (e) { failSafe(e); }
  }

  /* "Reduce motion" can be switched on or off while the page is open */
  function onReducedChange() {
    if (broken) return;
    if (reduced()) html.removeAttribute("data-mo-on");      // everything shows at once, no movement
    else if (started) html.setAttribute("data-mo-on", "");
    else start();
  }
  if (rmq.addEventListener) rmq.addEventListener("change", onReducedChange);
  else if (rmq.addListener) rmq.addListener(onReducedChange);

  function boot() {
    if (reduced()) return;        // "Reduce motion" is on: do nothing, the site shows normally
    start();                      // (if it's switched off later, onReducedChange() starts us up)
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* tiny handle for debugging / manual use */
  window.KCMotion = {
    refresh: function () { if (rootEl && !broken) walk(rootEl, false, 0); },
    off: function () { failSafe("turned off manually"); }
  };
})();
