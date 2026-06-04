import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("public access", () => {
  it("allows anonymous visitors to read shared data", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());

    await expect(caller.counterparties.list({})).resolves.toEqual(
      expect.any(Array)
    );
  });
});

describe("auth.me", () => {
  it("returns the authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.email).toBe("test@example.com");
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const clearedCookies: string[] = [];
    const ctx: TrpcContext = {
      ...createAuthContext(),
      res: {
        clearCookie: (name: string) => clearedCookies.push(name),
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies.length).toBeGreaterThan(0);
  });
});

describe("dashboard.stats", () => {
  it("returns stats object with numeric counts", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.dashboard.stats();
    expect(stats).toBeDefined();
    expect(typeof stats.counterparties).toBe("number");
    expect(typeof stats.contracts).toBe("number");
    expect(typeof stats.specifications).toBe("number");
    expect(typeof stats.waybills).toBe("number");
  });
});

describe("counterparties.list", () => {
  it("returns an array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const list = await caller.counterparties.list({});
    expect(Array.isArray(list)).toBe(true);
  });
});

describe("contracts.list", () => {
  it("returns an array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const list = await caller.contracts.list({});
    expect(Array.isArray(list)).toBe(true);
  });
});

describe("specifications.list", () => {
  it("returns an array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const list = await caller.specifications.list({});
    expect(Array.isArray(list)).toBe(true);
  });
});

describe("waybills.list", () => {
  it("returns an array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const list = await caller.waybills.list({});
    expect(Array.isArray(list)).toBe(true);
  });
});
