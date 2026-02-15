// /lib/crypto/types.ts

export type ExportedPublicKeys = {
  enc: string // base64
  sign: string // base64
}

export type EncryptedPayload = {
  ciphertext: string // base64
  iv: string // base64
}

export type SignedMessage = {
  payload: EncryptedPayload
  signature: string // base64
}
