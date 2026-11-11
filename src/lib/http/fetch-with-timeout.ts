/**
 * Corporate Office Store - Resilient Outbound Fetch with AbortController Timeout
 * Ensures external network calls respect the 8000ms SLA ceiling.
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
}

export class TimeoutError extends Error {
  constructor(message = "Request execution exceeded SLA timeout") {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = 8000, signal: callerSignal, ...init } = options;

  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new TimeoutError(`Request execution exceeded ${timeoutMs}ms SLA limit`));
  }, timeoutMs);

  // Link caller signal if provided
  const onCallerAbort = () => {
    controller.abort(callerSignal?.reason);
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timer);
      throw callerSignal.reason;
    }
    callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (timedOut || error?.name === "TimeoutError" || error?.name === "AbortError") {
      if (timedOut) {
        throw new TimeoutError(`Request execution exceeded ${timeoutMs}ms SLA limit`);
      }
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (callerSignal) {
      callerSignal.removeEventListener("abort", onCallerAbort);
    }
  }
}
