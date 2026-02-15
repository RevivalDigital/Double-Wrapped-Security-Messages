// /lib/crypto/encoding.ts

export function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

export function base64ToBuf(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function strToBuf(str: string): ArrayBuffer {
  return new TextEncoder().encode(str)
}

export function bufToStr(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf)
}
