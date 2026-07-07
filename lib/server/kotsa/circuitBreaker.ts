import {
  recordKotsaCallFailure,
  recordKotsaCallSuccess,
  setCircuitHealth,
} from "@/lib/server/kotsa/health";

type CircuitState = "closed" | "half_open" | "open";

let state: CircuitState = "closed";
let consecutiveFailures = 0;
let openedUntil = 0;

const failureThreshold = 5;
const openDurationMs = 30 * 1000;

export class KotsaCircuitOpenError extends Error {
  retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super("KOTSA circuit breaker is open.");
    this.name = "KotsaCircuitOpenError";
    this.retryAfterMs = retryAfterMs;
  }
}

export const assertKotsaCircuitAllowsRequest = () => {
  if (state !== "open") {
    return;
  }

  const now = Date.now();

  if (openedUntil <= now) {
    state = "half_open";
    setCircuitHealth(state, null, consecutiveFailures);
    return;
  }

  throw new KotsaCircuitOpenError(openedUntil - now);
};

export const recordCircuitSuccess = (responseTimeMs: number) => {
  state = "closed";
  consecutiveFailures = 0;
  openedUntil = 0;
  setCircuitHealth(state, null, consecutiveFailures);
  recordKotsaCallSuccess(responseTimeMs);
};

export const recordCircuitFailure = (
  responseTimeMs: number | null,
  message: string,
) => {
  consecutiveFailures += 1;
  recordKotsaCallFailure(responseTimeMs, message);

  if (consecutiveFailures >= failureThreshold || state === "half_open") {
    state = "open";
    openedUntil = Date.now() + openDurationMs;
  }

  setCircuitHealth(state, openedUntil || null, consecutiveFailures);
};

export const resetKotsaCircuitBreaker = () => {
  state = "closed";
  consecutiveFailures = 0;
  openedUntil = 0;
  setCircuitHealth(state, null, consecutiveFailures);
};
