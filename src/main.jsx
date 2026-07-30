import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

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
