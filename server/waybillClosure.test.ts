import { describe, expect, it } from "vitest";
import { resolveWaybillClosure } from "./waybillClosure";

describe("resolveWaybillClosure", () => {
  it("keeps dispatched and received weights independently", () => {
    expect(resolveWaybillClosure({ dispatchedWeight: "300", receivedWeight: "299.5" })).toEqual({
      dispatchedWeight: "300.000",
      receivedWeight: "299.500",
    });
  });

  it("requires both delivery measurements", () => {
    expect(() => resolveWaybillClosure({ dispatchedWeight: "300" })).toThrow("принятого покупателем");
    expect(() => resolveWaybillClosure({ receivedWeight: "299.5" })).toThrow("отгруженного товара");
  });
});
