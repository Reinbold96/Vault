/* ---------- WebAuthn App-Lock (Biometrie, OS-Fallback PIN) ---------- */
export const b64e = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const b64d = (s) => {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
export const bioAvailable = () => typeof window !== "undefined" && !!(window.PublicKeyCredential && navigator.credentials);

/* Einmal entsperrt bleibt die App für diese Sitzung offen – ein Neuladen
   (z. B. Pull-to-Refresh) sperrt sie dadurch nicht erneut. Beim echten
   Schliessen der App verwirft der Browser den Session-Speicher. */
export const UNLOCK_KEY = "vault_unlocked";
export const sessionUnlocked = () => { try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch { return false; } };
export const markUnlocked = () => { try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch { /* Privatmodus */ } };
export const clearUnlocked = () => { try { sessionStorage.removeItem(UNLOCK_KEY); } catch { /* Privatmodus */ } };
export async function bioRegister() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Vault", id: location.hostname },
      user: { id: userId, name: "vault", displayName: "Vault" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
      attestation: "none",
    },
  });
  return cred ? b64e(cred.rawId) : null;
}
export async function bioVerify(credId) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const pk = { challenge, timeout: 60000, userVerification: "required", rpId: location.hostname };
  if (credId) pk.allowCredentials = [{ type: "public-key", id: b64d(credId), transports: ["internal"] }];
  const res = await navigator.credentials.get({ publicKey: pk });
  return !!res;
}
