export interface WaybillClosureInput {
  dispatchedWeight?: string;
  receivedWeight?: string;
}

export interface ResolvedWaybillClosure {
  dispatchedWeight: string;
  receivedWeight: string;
}

function parseWeight(value: string | undefined, label: string) {
  if (value === undefined || value.trim() === "") return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} должен быть неотрицательным числом`);
  }
  return parsed;
}

export function resolveWaybillClosure(input: WaybillClosureInput): ResolvedWaybillClosure {
  const dispatched = parseWeight(input.dispatchedWeight, "Вес отгруженного товара");
  const received = parseWeight(input.receivedWeight, "Вес принятого товара");

  if (!dispatched || dispatched <= 0) throw new Error("Укажите вес отгруженного товара");
  if (!received || received <= 0) throw new Error("Укажите вес принятого покупателем товара");

  return {
    dispatchedWeight: dispatched.toFixed(3),
    receivedWeight: received.toFixed(3),
  };
}
