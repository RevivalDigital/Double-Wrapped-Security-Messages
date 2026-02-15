import PocketBase from "pocketbase";

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || "";

export const pb = new PocketBase(PB_URL);
