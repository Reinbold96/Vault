import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

/* Zoom komplett unterbinden, damit sich die App wie eine native App anfuehlt.
   Nur `user-scalable=no` reicht auf iOS nicht: Safari erlaubt weiterhin Pinch-
   und Doppeltipp-Zoom. Deshalb die iOS-Gesten aktiv abfangen. `touch-action`
   im <body> deckt bereits den Doppeltipp ab; hier zusaetzlich der Pinch-Zoom. */
["gesturestart", "gesturechange", "gestureend"].forEach((ev) =>
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
);
document.addEventListener(
  "touchmove",
  (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); },
  { passive: false }
);

/* Tastatur schliessen wie in einer nativen App:
   - Enter/Return in einem einzeiligen Feld gibt den Fokus frei (Textareas
     behalten Enter fuer den Zeilenumbruch).
   - Tippen ins Leere (auf kein Bedienelement) schliesst die Tastatur.
   Global geloest, damit es fuer jedes Eingabefeld gilt. */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const el = document.activeElement;
  if (el && el.tagName === "INPUT") el.blur();
});

let kbTouchMoved = false;
document.addEventListener("touchstart", () => { kbTouchMoved = false; }, { passive: true });
document.addEventListener("touchmove", () => { kbTouchMoved = true; }, { passive: true });
document.addEventListener(
  "touchend",
  (e) => {
    if (kbTouchMoved) return; // Wischen/Scrollen soll nicht ausloesen
    const el = document.activeElement;
    if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
    const t = e.target;
    if (t && t !== el && !(t.closest && t.closest("input, textarea, select, label, button"))) {
      el.blur();
    }
  },
  { passive: true }
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    /* Gab es beim Laden schon einen Controller, ist die App bereits installiert.
       Nur dann ist ein Controller-Wechsel ein echtes Update und ein Reload sinnvoll. */
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });

    try {
      const reg = await navigator.serviceWorker.register("./sw.js");

      /* iOS setzt installierte Web-Apps aus dem Hintergrund fort statt sie neu zu
         starten - dabei sucht Safari von sich aus nicht nach einer neuen Version.
         Deshalb bei jeder Rueckkehr in den Vordergrund aktiv nachfragen. */
      const check = () => {
        if (document.visibilityState !== "visible") return;
        reg.update().catch(() => {});
        if (reg.waiting) reg.waiting.postMessage("skipWaiting");
      };
      document.addEventListener("visibilitychange", check);
      window.addEventListener("focus", check);
      window.addEventListener("online", check);
      setInterval(check, 30 * 60 * 1000);

      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && reg.waiting) reg.waiting.postMessage("skipWaiting");
        });
      });
    } catch {
      /* ohne Service Worker laeuft die App normal weiter */
    }
  });
}
