import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getAuthenticatedUser, type AuthenticatedUser } from "./passwordAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: await getAuthenticatedUser(opts.req),
  };
}
