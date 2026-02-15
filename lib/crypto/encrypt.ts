// /lib/crypto/encrypt.ts

import { bufToBase64, base64ToBuf, strToBuf, bufToStr } from "./encoding"
import { EncryptedPayload } from "./types"

export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    strToBuf(plaintext)
  )

  return {
    ciphertext: bufToBase64(ciphertext),
    iv: bufToBase64(iv.buffer),
  }
}

export async function decryptMessage(
  key: CryptoKey,
  payload: EncryptedPayload
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(base64ToBuf(payload.iv)),
    },
    key,
    base64ToBuf(payload.ciphertext)
  )

  return bufToStr(decrypted)
}
