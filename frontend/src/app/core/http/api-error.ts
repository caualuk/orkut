import { HttpErrorResponse } from '@angular/common/http';

/** Formato padronizado de erro retornado pela API. */
interface ApiErrorBody {
  error?: { code?: unknown; message?: unknown };
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

const FALLBACK_MESSAGES: Record<number, string> = {
  0: 'Não foi possível conectar ao servidor. Verifique sua internet.',
  401: 'E-mail ou senha inválidos.',
  403: 'Requisição não autorizada.',
  429: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
};

const GENERIC_MESSAGE = 'Algo deu errado. Tente novamente em instantes.';

/**
 * Converte qualquer erro HTTP em uma mensagem segura para exibir ao usuário.
 * Erros 5xx nunca exibem detalhes vindos do servidor.
 */
export function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: -1, code: 'UNKNOWN', message: GENERIC_MESSAGE };
  }

  const body = (error.error ?? {}) as ApiErrorBody;
  const code = typeof body.error?.code === 'string' ? body.error.code : 'UNKNOWN';
  const serverMessage = typeof body.error?.message === 'string' ? body.error.message : undefined;
  const isServerFailure = error.status >= 500;

  return {
    status: error.status,
    code,
    message:
      (!isServerFailure && serverMessage) || FALLBACK_MESSAGES[error.status] || GENERIC_MESSAGE,
  };
}
