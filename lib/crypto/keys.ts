// /lib/crypto/keys.ts

import { bufToBase64, base64ToBuf } from "./encoding"

export async function generateEncryptionKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "X25519",
    },
    false, // private key NON-extractable
    ["deriveKey"]
  )
}

export async function generateSigningKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: "Ed25519",
    },
    false,
    ["sign", "verify"]
  )
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key)
  return bufToBase64(raw)
}

export async function importEncryptionPublicKey(base64: string) {
  return crypto.subtle.importKey(
    "raw",
    base64ToBuf(base64),
    {
      name: "ECDH",
      namedCurve: "X25519",
    },
    false,
    []
  )
}

export async function importSigningPublicKey(base64: string) {
  return crypto.subtle.importKey(
    "raw",
    base64ToBuf(base64),
    {
      name: "Ed25519",
    },
    false,
    ["verify"]
  )
}
