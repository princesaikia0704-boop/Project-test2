/**
 * Typed custom error classes for the Office Store application.
 *
 * Usage:
 *   throw new ValidationError("Price must be positive", "INVALID_PRICE");
 *   throw new InsufficientStockError("productId-123", 5, 2);
 *
 * API handlers catch these and map to appropriate HTTP status codes.
 */

// ─── Base Error ───────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;

    // Maintains proper prototype chain in transpiled code
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Specific Error Classes ───────────────────────────────────────────────────

/** Thrown when request input fails Zod schema validation. */
export class ValidationError extends AppError {
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(message, code, 400);
  }
}

/** Thrown when a user lacks permissions for a resource or action. */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", code = "UNAUTHORIZED") {
    super(message, code, 401);
  }
}

/** Thrown when a user's role doesn't allow the requested action. */
export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions", code = "FORBIDDEN") {
    super(message, code, 403);
  }
}

/** Thrown when a requested resource does not exist. */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id ? `${resource} '${id}' not found` : `${resource} not found`;
    super(msg, "NOT_FOUND", 404);
  }
}

/** Thrown when a product's stock is insufficient for the requested quantity. */
export class InsufficientStockError extends AppError {
  public readonly productId: string;
  public readonly requested: number;
  public readonly available: number;

  constructor(productId: string, requested: number, available: number) {
    super(
      `Insufficient stock for product '${productId}': requested ${requested}, available ${available}`,
      "INSUFFICIENT_STOCK",
      409
    );
    this.productId = productId;
    this.requested = requested;
    this.available = available;
  }
}

/** Thrown when an order exceeds the department budget. */
export class BudgetExceededError extends AppError {
  constructor(orderCents: number, remainingCents: number) {
    super(
      `Order total ₹${(orderCents / 100).toFixed(2)} exceeds remaining budget ₹${(remainingCents / 100).toFixed(2)}`,
      "BUDGET_EXCEEDED",
      409
    );
  }
}

/** Thrown when an operation is attempted on an order in an invalid state. */
export class InvalidOrderStateError extends AppError {
  constructor(orderId: string, currentStatus: string, attemptedAction: string) {
    super(
      `Cannot ${attemptedAction} order '${orderId}' with status '${currentStatus}'`,
      "INVALID_ORDER_STATE",
      409
    );
  }
}

/** Thrown when an external service (DB, API) times out. */
export class TimeoutError extends AppError {
  constructor(service: string) {
    super(`Request to ${service} timed out`, "TIMEOUT", 504);
  }
}

/** Thrown when a duplicate request is detected via Idempotency-Key. */
export class DuplicateRequestError extends AppError {
  constructor(key: string) {
    super(`Duplicate request detected for key: ${key}`, "DUPLICATE_REQUEST", 409);
  }
}

// ─── Type Guard ───────────────────────────────────────────────────────────────

/** Returns true if the error is a known operational AppError. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Maps an AppError to a standard API error response object.
 * Unknown errors become a generic 500 Internal Server Error.
 */
export function toApiErrorResponse(error: unknown): {
  body: { error: string; code: string; message?: string };
  statusCode: number;
} {
  if (isAppError(error)) {
    return {
      body: { error: error.name, code: error.code, message: error.message },
      statusCode: error.statusCode,
    };
  }

  const message = error instanceof Error ? error.message : "An unexpected error occurred";
  return {
    body: { error: "InternalServerError", code: "INTERNAL_ERROR", message },
    statusCode: 500,
  };
}
