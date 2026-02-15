import * as CryptoJS from "crypto-js";

const KEY1 = process.env.NEXT_PUBLIC_KEY1 || "";
const KEY2 = process.env.NEXT_PUBLIC_KEY2 || "";
const INTERNAL_APP_KEY = KEY1 + KEY2;

export const encryptSalt = (raw: string) =>
  CryptoJS.AES.encrypt(raw, INTERNAL_APP_KEY).toString();

export const decryptSalt = (enc: string) => {
  if (!enc) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(enc, INTERNAL_APP_KEY);
    return bytes.toString(CryptoJS.enc.Utf8) || null;
  } catch {
    return null;
  }
};

export const generateChatKey = (
  id1: string,
  id2: string,
  salt: string
) => {
  const combined = [id1, id2].sort().join("");
  return CryptoJS.SHA256(
    combined + salt + INTERNAL_APP_KEY
  ).toString();
};

export const encryptMessage = (
  text: string,
  key: string
) => CryptoJS.AES.encrypt(text, key).toString();

export const decryptMessage = (
  text: string,
  key: string
) => {
  try {
    const bytes = CryptoJS.AES.decrypt(text, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return "";
  }
};
