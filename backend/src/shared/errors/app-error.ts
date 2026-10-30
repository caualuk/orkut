/**
 * Erro de domínio com status HTTP e código estável consumido pelo frontend.
 * A mensagem é sempre segura para exibição ao usuário final.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message = 'Requisição inválida.', details?: unknown): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Não autenticado.'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static invalidCredentials(): AppError {
    // Mensagem genérica: não revela se o e-mail existe (anti-enumeração).
    return new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  }

  /** Senha de confirmação incorreta numa ação sensível (sessão já autenticada). */
  static invalidPassword(): AppError {
    return new AppError(403, 'INVALID_PASSWORD', 'Senha incorreta.');
  }

  static forbidden(message = 'Acesso negado.'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Recurso não encontrado.'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static emailTaken(): AppError {
    return new AppError(409, 'EMAIL_TAKEN', 'Este e-mail já está em uso. Tente entrar.');
  }

  static tooManyRequests(): AppError {
    return new AppError(
      429,
      'TOO_MANY_REQUESTS',
      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    );
  }
}
