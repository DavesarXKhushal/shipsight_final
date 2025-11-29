import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type StoredUser = {
  email: string;
  username?: string;
  displayName?: string;
  iterations: number;
  salt: string;
  hash: string;
};

type PlainUser = { username: string; email: string; password: string; displayName: string };
const DEFAULT_USERS_PLAINTEXT: PlainUser[] = [
  { username: "oora", email: "oora@shipsight.com", password: "OoraShip2025!", displayName: "Oora" },
  { username: "as international", email: "as.international@shipsight.com", password: "AsIntl2025!", displayName: "AS International" },
  { username: "ss international", email: "ss.international@shipsight.com", password: "SsIntl2025!", displayName: "SS International" },
  { username: "admin", email: "admin@shipsight.com", password: "AdminShip2025!", displayName: "Administrator" },
  { username: "rohit", email: "rohit@shipsight.com", password: "RohitShip2025!", displayName: "Rohit" },
];

function getStore(): Record<string, StoredUser> {
  try {
    const raw = localStorage.getItem("shipsight_passwords");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setStore(store: Record<string, StoredUser>) {
  try {
    localStorage.setItem("shipsight_passwords", JSON.stringify(store));
  } catch {}
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

async function deriveBitsPBKDF2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return bytesToBase64(bits);
}

export async function setUserPassword(user: { email: string; username?: string; displayName?: string }, password: string, iterations = 100000): Promise<StoredUser> {
  const email = user.email.toLowerCase();
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await deriveBitsPBKDF2(password, salt, iterations);
  const rec: StoredUser = { email, username: user.username, displayName: user.displayName, iterations, salt: bytesToBase64(salt), hash };
  const store = getStore();
  store[email] = rec;
  setStore(store);
  return rec;
}

export function findUser(query: string): { email: string; user: StoredUser } | null {
  const q = query.toLowerCase();
  const store = getStore();
  if (store[q]) return { email: q, user: store[q] };
  for (const [email, u] of Object.entries(store)) {
    if ((u.username || "").toLowerCase() === q) return { email, user: u };
  }
  const du = DEFAULT_USERS_PLAINTEXT.find(u => u.email.toLowerCase() === q || u.username.toLowerCase() === q);
  if (du) {
    const pseudo: StoredUser = { email: du.email.toLowerCase(), username: du.username, displayName: du.displayName, iterations: 0, salt: "", hash: "" };
    return { email: pseudo.email, user: pseudo };
  }
  return null;
}

export async function verifyUserPassword(query: string, password: string): Promise<{ ok: boolean; email?: string; user?: StoredUser }> {
  const found = findUser(query);
  if (!found) return { ok: false };
  const { email, user } = found;
  if (user.iterations && user.salt) {
    const salt = base64ToBytes(user.salt);
    const hash = await deriveBitsPBKDF2(password, salt, user.iterations);
    return { ok: hash === user.hash, email, user };
  }
  const du = DEFAULT_USERS_PLAINTEXT.find(u => u.email.toLowerCase() === email || u.username.toLowerCase() === email);
  if (!du) return { ok: false };
  const ok = du.password === password;
  const pseudo: StoredUser = { email: du.email.toLowerCase(), username: du.username, displayName: du.displayName, iterations: 0, salt: "", hash: "" };
  return { ok, email: pseudo.email, user: pseudo };
}

export async function changeUserPassword(email: string, oldPassword: string, newPassword: string): Promise<boolean> {
  const found = findUser(email);
  if (!found) return false;
  const { user } = found;
  if (user.iterations && user.salt) {
    const salt = base64ToBytes(user.salt);
    const oldHash = await deriveBitsPBKDF2(oldPassword, salt, user.iterations);
    if (oldHash !== user.hash) return false;
  } else {
    const du = DEFAULT_USERS_PLAINTEXT.find(u => u.email.toLowerCase() === user.email);
    if (!du || du.password !== oldPassword) return false;
  }
  const iterations = user.iterations || 100000;
  const newSalt = new Uint8Array(16);
  crypto.getRandomValues(newSalt);
  const newHash = await deriveBitsPBKDF2(newPassword, newSalt, iterations);
  const store = getStore();
  store[user.email] = { ...user, salt: bytesToBase64(newSalt), hash: newHash, iterations };
  setStore(store);
  return true;
}
