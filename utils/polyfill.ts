// utils/polyfill.ts
// Polyfill apenas para Node.js
if (typeof window === "undefined") {
  // estamos no Node.js
  import("node:crypto").then(({ webcrypto }) => {
    // @ts-ignore
    if (!globalThis.crypto) globalThis.crypto = webcrypto;
  });
}
