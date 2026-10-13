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

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NAO_ENCONTRADO");
  }
}


export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLITO");
  }
}

export class RegraDeNegocioError extends AppError {
  constructor(message: string) {
    super(message, 422, "REGRAS_DE_NEGOCIO");
  }
}