import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import type { User } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let host: HTMLElement;
  let login$: Subject<User>;
  let auth: { login: ReturnType<typeof vi.fn> };
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  const fillAndSubmit = async () => {
    const email = host.querySelector<HTMLInputElement>('[data-testid="email-input"]')!;
    const password = host.querySelector<HTMLInputElement>('[data-testid="password-input"]')!;
    email.value = 'paulo@orkut.com';
    email.dispatchEvent(new Event('input'));
    password.value = 'segredo';
    password.dispatchEvent(new Event('input'));
    host.querySelector<HTMLButtonElement>('[data-testid="login-submit"]')!.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    login$ = new Subject<User>();
    auth = { login: vi.fn(() => login$) };

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();

    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    host = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('renderiza o hero do design e a cena decorativa oculta de leitores de tela', () => {
    expect(host.textContent).toContain('A NOSTALGIA, REIMAGINADA');
    expect(host.textContent).toContain('Seus amigos, scraps e comunidades. De volta.');
    expect(host.querySelector('ok-login-scene')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('main ok-login-form')).toBeTruthy();
  });

  it('autentica e navega para /home por padrão', async () => {
    await fillAndSubmit();
    expect(auth.login).toHaveBeenCalledWith({
      email: 'paulo@orkut.com',
      password: 'segredo',
      remember: false,
    });

    login$.next({ id: '1', email: 'paulo@orkut.com', displayName: 'Paulo' });
    login$.complete();
    expect(navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('respeita returnUrl interno', async () => {
    fixture.componentRef.setInput('returnUrl', '/comunidades');
    await fillAndSubmit();
    login$.next({ id: '1', email: 'paulo@orkut.com', displayName: 'Paulo' });
    expect(navigateByUrl).toHaveBeenCalledWith('/comunidades');
  });

  it('ignora returnUrl externo (Open Redirect)', async () => {
    fixture.componentRef.setInput('returnUrl', '//evil.com/phishing');
    await fillAndSubmit();
    login$.next({ id: '1', email: 'paulo@orkut.com', displayName: 'Paulo' });
    expect(navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('mostra estado de carregamento e depois a mensagem de erro da API', async () => {
    await fillAndSubmit();
    expect(host.querySelector('[data-testid="login-submit"]')?.textContent).toContain('Entrando…');

    login$.error(
      new HttpErrorResponse({
        status: 401,
        error: { error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' } },
      }),
    );
    await fixture.whenStable();

    expect(host.querySelector('[data-testid="login-error"]')?.textContent).toContain(
      'E-mail ou senha inválidos.',
    );
    expect(host.querySelector('[data-testid="login-submit"]')?.textContent).toContain(
      'Entrar no orkut',
    );
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
