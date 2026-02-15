// /lib/crypto/sign.ts

import { bufToBase64, base64ToBuf } from "./encoding"

export async function signData(
  privateKey: CryptoKey,
  data: ArrayBuffer
): Promise<string> {
  const signature = await crypto.subtle.sign(
    {
      name: "Ed25519",
    },
    privateKey,
    data
  )

  return bufToBase64(signature)
}

export async function verifySignature(
  publicKey: CryptoKey,
  signatureBase64: string,
  data: ArrayBuffer
): Promise<boolean> {
  return crypto.subtle.verify(
    {
      name: "Ed25519",
    },
    publicKey,
    base64ToBuf(signatureBase64),
    data
  )
}
