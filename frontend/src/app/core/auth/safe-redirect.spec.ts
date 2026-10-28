import { DEFAULT_AUTHENTICATED_ROUTE, sanitizeReturnUrl } from './safe-redirect';

describe('sanitizeReturnUrl', () => {
  it.each(['/home', '/comunidades/123?tab=membros', '/perfil#recados'])(
    'aceita caminho interno %s',
    (url) => {
      expect(sanitizeReturnUrl(url)).toBe(url);
    },
  );

  it.each([
    [null],
    [undefined],
    [''],
    ['https://evil.com'],
    ['//evil.com'],
    ['/\\evil.com'],
    ['\\\\evil.com'],
    ['javascript:alert(1)'],
    ['home'],
    ['/ evil'],
    ['/\u0000evil'],
    ['/login'],
    ['/login?returnUrl=/home'],
    ['/' + 'a'.repeat(3000)],
  ])('recusa %s (Open Redirect) e usa a rota padrão', (url) => {
    expect(sanitizeReturnUrl(url)).toBe(DEFAULT_AUTHENTICATED_ROUTE);
  });
});
