export class AppError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code: string,
    ) {
        super(message);
        this.name = new.target.name;
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Autenticação necessária") {
        super(message, 401, "UNAUTHORIZED");
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "Acesso negado") {
        super(message, 403, "FORBIDDEN");
    }
}

export class NotFoundError extends AppError {
    constructor(message: string) {
        super(message, 404, "NOT_FOUND");
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, "CONFLICT");
    }
}

export class BusinessRuleError extends AppError {
    constructor(message: string) {
        super(message, 422, "BUSINESS_RULE");
    }
}
