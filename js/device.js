/*
 * What this browser can do, used to explain downloads and home screen installs.
 *
 * In-app browsers (opened from links inside Instagram, Facebook, TikTok,
 * LinkedIn, and similar apps) usually block file downloads and cannot add
 * pages to the home screen, so visitors need to open the page in Safari or
 * Chrome first.
 */
(function (root) {
  "use strict";

  var ua = navigator.userAgent || "";
  var inAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|MicroMessenger|Twitter|TikTok|BytedanceWebview|musical_ly|Snapchat|Pinterest|; wv\)/i.test(ua);
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var canDownload = !inAppBrowser && ("download" in document.createElement("a"));

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  }

  root.SchengenDevice = { inAppBrowser: inAppBrowser, isIOS: isIOS, canDownload: canDownload, isStandalone: isStandalone };
})(this);
