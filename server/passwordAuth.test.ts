import { afterEach, describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  createPasswordHash,
  createSessionToken,
  getAuthenticatedUser,
  verifyAdminCredentials,
} from "./_core/passwordAuth";

const originalEnvironment = {
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  SESSION_SECRET: process.env.SESSION_SECRET,
};

afterEach(() => {
  Object.assign(process.env, originalEnvironment);
});

describe("password authentication", () => {
  it("accepts only the configured password and creates an http-only-cookie session", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = await createPasswordHash("Correct-Horse-Battery-Staple");
    process.env.SESSION_SECRET = "a-test-session-secret-that-is-long-enough";

    await expect(verifyAdminCredentials("admin", "Correct-Horse-Battery-Staple")).resolves.toBe(true);
    await expect(verifyAdminCredentials("admin", "incorrect")).resolves.toBe(false);

    const token = await createSessionToken("admin");
    const user = await getAuthenticatedUser({ headers: { cookie: `app_session_id=${token}` } } as Request);
    expect(user).toMatchObject({ openId: "admin", role: "admin", loginMethod: "password" });
  });
});
