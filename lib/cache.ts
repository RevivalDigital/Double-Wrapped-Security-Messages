import * as CryptoJS from "crypto-js";

const KEY = (process.env.NEXT_PUBLIC_KEY1 || "") +
            (process.env.NEXT_PUBLIC_KEY2 || "");

const encrypt = (data: any) =>
  CryptoJS.AES.encrypt(JSON.stringify(data), KEY).toString();

const decrypt = (str: string) => {
  try {
    const bytes = CryptoJS.AES.decrypt(str, KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch {
    return null;
  }
};

export const cache = {
  get(userId: string, friendId: string) {
    const raw = localStorage.getItem(
      `chat_${userId}_${friendId}`
    );
    return raw ? decrypt(raw) : null;
  },

  set(userId: string, friendId: string, data: any) {
    localStorage.setItem(
      `chat_${userId}_${friendId}`,
      encrypt({
        data,
        ts: Date.now(),
      })
    );
  },

  clear(userId: string) {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(`chat_${userId}_`))
        localStorage.removeItem(k);
    });
  },
};
