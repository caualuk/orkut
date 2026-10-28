import type { CookieOptions, Request, Response } from 'express';
import type { AppConfig } from '../../config/env.js';

/**
 * Centraliza as opções do cookie de sessão:
 * - HttpOnly: inacessível via JavaScript (mitiga roubo por XSS);
 * - SameSite=Strict: não é enviado em navegação cross-site (mitiga CSRF);
 * - Secure em produção (somente HTTPS).
 */
export class SessionCookie {
  constructor(private readonly config: AppConfig) {}

  private get baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'strict',
      path: '/',
    };
  }

  read(req: Request): string | undefined {
    const value: unknown = req.cookies?.[this.config.session.cookieName];
    return typeof value === 'string' ? value : undefined;
  }

  write(res: Response, token: string, expiresAt: Date, persistent: boolean): void {
    res.cookie(this.config.session.cookieName, token, {
      ...this.baseOptions,
      // Sem "Lembrar de mim" o cookie é de sessão do navegador; o servidor expira mesmo assim.
      ...(persistent && { expires: expiresAt }),
    });
  }

  clear(res: Response): void {
    res.clearCookie(this.config.session.cookieName, this.baseOptions);
  }
}
