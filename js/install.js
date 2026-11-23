/*
 * Add to Home Screen prompt.
 * Chrome, Edge, and Android use the browser's install dialog.
 * iPhone and iPad have no install dialog, so the banner explains the
 * Share > Add to Home Screen steps instead.
 */
(function () {
  "use strict";

  var DISMISS_KEY = "schengen-install-dismissed";
  var DISMISS_DAYS = 30;

  var inFrame;
  try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }

  // Offline support for the installed app.
  if (!inFrame && "serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* offline support is optional */ });
    });
  }

  var banner = document.getElementById("install-banner");
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
      return at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
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

  // iPhone and iPad (iPadOS reports itself as a Mac with touch support).
  var ua = navigator.userAgent || "";
  var isIOS = /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) {
    acceptBtn.hidden = true;
    hint.innerHTML = 'Tap the Share button <span class="share-glyph" aria-hidden="true"></span>, then choose <strong>Add to Home Screen</strong>.';
    setTimeout(show, 2000);
  }
})();
