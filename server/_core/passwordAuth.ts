import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { Request } from "express";
import { parse } from "cookie";
import { COOKIE_NAME } from "@shared/const";

const SESSION_DURATION_SECONDS = 12 * 60 * 60;
const SCRYPT_PARAMS = { N: 16_384, r: 8, p: 1 };

export type AuthenticatedUser = {
  id: 0;
  openId: string;
  name: string;
  email: null;
  loginMethod: "password";
  role: "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

type PasswordHashParts = {
  salt: Buffer;
  hash: Buffer;
};

function derivePasswordKey(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, SCRYPT_PARAMS, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Buffer.from(derivedKey));
    });
  });
}

function sessionSecret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  return new TextEncoder().encode(value);
}

function passwordHashParts(value: string): PasswordHashParts | null {
  const [algorithm, n, r, p, salt, hash] = value.split("$");
  if (
    algorithm !== "scrypt" ||
    n !== String(SCRYPT_PARAMS.N) ||
    r !== String(SCRYPT_PARAMS.r) ||
    p !== String(SCRYPT_PARAMS.p) ||
    !salt ||
    !hash
  ) {
    return null;
  }

  try {
    return { salt: Buffer.from(salt, "base64url"), hash: Buffer.from(hash, "base64url") };
  } catch {
    return null;
  }
}

export async function createPasswordHash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derivePasswordKey(password, salt, 64);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!configuredUsername || !configuredPasswordHash) return false;

  const hashParts = passwordHashParts(configuredPasswordHash);
  if (!hashParts) {
    console.error("ADMIN_PASSWORD_HASH has an unsupported format");
    return false;
  }

  const candidate = await derivePasswordKey(password, hashParts.salt, hashParts.hash.length);
  const usernameMatches = Buffer.from(username).length === Buffer.from(configuredUsername).length &&
    timingSafeEqual(Buffer.from(username), Buffer.from(configuredUsername));
  return usernameMatches && timingSafeEqual(candidate, hashParts.hash);
}

export async function createSessionToken(username: string): Promise<string> {
  return new SignJWT({ role: "admin", loginMethod: "password" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(sessionSecret());
}

export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const token = parse(req.headers.cookie ?? "")[COOKIE_NAME];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (
      payload.role !== "admin" ||
      payload.loginMethod !== "password" ||
      typeof payload.sub !== "string" ||
      payload.sub !== process.env.ADMIN_USERNAME
    ) {
      return null;
    }
    const now = new Date();
    return {
      id: 0,
      openId: payload.sub,
      name: payload.sub,
      email: null,
      loginMethod: "password",
      role: "admin",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE_MS = SESSION_DURATION_SECONDS * 1000;
