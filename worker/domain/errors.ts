export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "USER_INACTIVE"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PRECONDITION_REQUIRED"
  | "INVALID_STATUS_TRANSITION"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "ATTACHMENT_LIMIT_REACHED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  USER_INACTIVE: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_REQUIRED: 428,
  INVALID_STATUS_TRANSITION: 422,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  ATTACHMENT_LIMIT_REACHED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.fields = fields;
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

export interface ErrorBody {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
    requestId: string;
  };
}

export function errorBody(
  code: ErrorCode,
  message: string,
  requestId: string,
  fields?: Record<string, string>
): ErrorBody {
  return {
    ok: false,
    error: fields ? { code, message, fields, requestId } : { code, message, requestId },
  };
}

export interface OkBody<T> {
  ok: true;
  data: T;
}

export function okBody<T>(data: T): OkBody<T> {
  return { ok: true, data };
}
