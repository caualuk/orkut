import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

const httpError = (status: number, error: unknown = null) =>
  new HttpErrorResponse({ status, error });

describe('toApiError', () => {
  it('usa a mensagem da API para erros 4xx', () => {
    const result = toApiError(
      httpError(401, {
        error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' },
      }),
    );
    expect(result).toEqual({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'E-mail ou senha inválidos.',
    });
  });

  it('nunca repassa detalhes de erros 5xx', () => {
    const result = toApiError(
      httpError(500, { error: { code: 'X', message: 'duplicate key at users_pkey' } }),
    );
    expect(result.message).toBe('Algo deu errado. Tente novamente em instantes.');
  });

  it('trata falha de rede (status 0)', () => {
    expect(toApiError(httpError(0)).message).toMatch(/conectar ao servidor/);
  });

  it('usa fallback para 429 sem corpo', () => {
    expect(toApiError(httpError(429)).message).toMatch(/Muitas tentativas/);
  });

  it('ignora corpo com tipos inesperados', () => {
    const result = toApiError(httpError(400, { error: { message: { html: '<b>x</b>' } } }));
    expect(result.message).toBe('Algo deu errado. Tente novamente em instantes.');
  });

  it('trata erros que não são HTTP', () => {
    expect(toApiError(new Error('boom')).code).toBe('UNKNOWN');
  });
});
