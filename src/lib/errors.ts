export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "No s’ha trobat el registre") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "No tens permís per fer aquesta acció") {
    super(message, "FORBIDDEN", 403);
  }
}

export function publicError(error: unknown) {
  if (error instanceof AppError) {
    return { message: error.message, code: error.code, status: error.status };
  }
  return { message: "S’ha produït un error inesperat", code: "INTERNAL_ERROR", status: 500 };
}
