export const DEFAULT_AUTHENTICATED_ROUTE = '/home';

/**
 * Valida o parâmetro `returnUrl` para evitar Open Redirect: aceita apenas
 * caminhos internos absolutos ("/algo"), recusando URLs de protocolo relativo
 * ("//evil.com"), barras invertidas e esquemas como "javascript:".
 */
export function sanitizeReturnUrl(value: string | null | undefined): string {
  if (!value || value.length > 2048) return DEFAULT_AUTHENTICATED_ROUTE;

  const isInternalPath = value.startsWith('/') && !value.startsWith('//');
  const hasDangerousChars =
    /[\\\s]/.test(value) || [...value].some((char) => char.charCodeAt(0) < 0x20);
  const pointsBackToLogin = /^\/login(?:[/?#]|$)/.test(value);

  if (!isInternalPath || hasDangerousChars || pointsBackToLogin) {
    return DEFAULT_AUTHENTICATED_ROUTE;
  }
  return value;
}
