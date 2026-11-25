/*
 * Add to Home Screen prompt.
 * Chrome, Edge, and Android use the browser's install dialog.
 * iPhone and iPad have no install dialog, so the banner explains the
 * Share > Add to Home Screen steps instead.
 */
(function () {
  "use strict";

  var DISMISS_KEY = "schengen-install-dismissed";
  var DISMISS_HOURS = 24; // Close hides the banner for this long

  var inFrame;
  try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }

  // Offline support for the installed app.
  // Trusted Types (see the Content-Security-Policy) blocks script URLs unless a
  // named policy creates them. This policy allows exactly one URL: sw.js.
  function serviceWorkerUrl() {
    if (!window.trustedTypes || !window.trustedTypes.createPolicy) return "sw.js";
    var policy = window.trustedTypes.createPolicy("schengen-sw", {
      createScriptURL: function (url) {
        if (url !== "sw.js") throw new TypeError("Blocked script URL: " + url);
        return url;
      }
    });
    return policy.createScriptURL("sw.js");
  }

  if (!inFrame && "serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(serviceWorkerUrl()).catch(function () { /* offline support is optional */ });
    });
  }

  var banner = document.getElementById("install-banner");
  // Called when a download could not happen: show the banner with steps for
  // this browser, even if the visitor dismissed it earlier.
  window.SchengenInstall = { remind: function () {} };
  if (!banner || inFrame) return;

  var hint = document.getElementById("install-hint");
  var acceptBtn = document.getElementById("install-accept");
  var dismissBtn = document.getElementById("install-dismiss");
  var deferredPrompt = null;

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  }

  function recentlyDismissed() {
    try {
      var at = Number(localStorage.getItem(DISMISS_KEY));
      return at && Date.now() - at < DISMISS_HOURS * 60 * 60 * 1000;
    } catch (e) {
      return false;
    }
  }

  // Share the banner's height so the back to top button can sit just above it.
  function syncBannerHeight() {
    document.documentElement.style.setProperty("--install-banner-height", banner.hidden ? "0px" : banner.offsetHeight + "px");
  }
  window.addEventListener("resize", syncBannerHeight);

  function show() {
    if (isStandalone() || recentlyDismissed()) return;
    banner.hidden = false;
    document.body.classList.add("has-install-banner");
    syncBannerHeight();
  }

  function hide() {
    banner.hidden = true;
    document.body.classList.remove("has-install-banner");
    syncBannerHeight();
  }

  dismissBtn.addEventListener("click", function () {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) { /* ignore */ }
    hide();
  });

  // Chrome, Edge, Samsung Internet, and other Chromium browsers.
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    acceptBtn.hidden = false;
    show();
  });

  acceptBtn.addEventListener("click", function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {
      deferredPrompt = null;
      hide();
    });
  });

  window.addEventListener("appinstalled", hide);

  /*
   * Fill the banner hint from parts, without HTML strings:
   * plain strings, { strong: "..." } for bold text, and SHARE_GLYPH for the share icon.
   */
  var SHARE_GLYPH = { glyph: true };
  function setHint(parts) {
    hint.replaceChildren();
    parts.forEach(function (part) {
      if (typeof part === "string") {
        hint.appendChild(document.createTextNode(part));
      } else if (part.glyph) {
        var icon = document.createElement("span");
        icon.className = "share-glyph";
        icon.setAttribute("aria-hidden", "true");
        hint.appendChild(icon);
      } else {
        var b = document.createElement("strong");
        b.textContent = part.strong;
        hint.appendChild(b);
      }
    });
  }
  var IOS_STEPS = ["Tap the Share button ", SHARE_GLYPH, ", then choose ", { strong: "Add to Home Screen" }, "."];

  var D = window.SchengenDevice || {};
  window.SchengenInstall.remind = function () {
    if (isStandalone()) return;
    if (D.inAppBrowser) {
      acceptBtn.hidden = true;
      setHint(["Open this page in ", { strong: "Safari or Chrome" }, " (use this app's menu, then ", { strong: "Open in browser" }, "), then add it to your Home Screen."]);
    } else if (deferredPrompt) {
      acceptBtn.hidden = false;
      hint.textContent = "Install the calculator to save files and open it like an app, even offline.";
    } else if (D.isIOS) {
      acceptBtn.hidden = true;
      setHint(IOS_STEPS);
    } else {
      acceptBtn.hidden = true;
      setHint(["Open your browser menu, then choose ", { strong: "Add to Home Screen" }, " or ", { strong: "Install app" }, "."]);
    }
    banner.hidden = false;
    document.body.classList.add("has-install-banner");
    syncBannerHeight();
  };

  // iPhone and iPad (iPadOS reports itself as a Mac with touch support).
  var ua = navigator.userAgent || "";
  var isIOS = /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) {
    acceptBtn.hidden = true;
    setHint(IOS_STEPS);
    setTimeout(show, 2000);
  }
})();
