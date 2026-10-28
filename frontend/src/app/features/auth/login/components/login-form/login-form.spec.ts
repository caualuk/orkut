import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { LoginCredentials } from '../../../../../core/auth/auth.models';
import { LoginForm } from './login-form';

describe('LoginForm', () => {
  let fixture: ComponentFixture<LoginForm>;
  let host: HTMLElement;
  let emitted: LoginCredentials[];

  const $ = <T extends HTMLElement>(testId: string) =>
    host.querySelector<T>(`[data-testid="${testId}"]`);

  const type = (testId: string, value: string) => {
    const input = $<HTMLInputElement>(testId)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  const submit = async () => {
    $<HTMLButtonElement>('login-submit')!.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginForm],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginForm);
    host = fixture.nativeElement;
    emitted = [];
    fixture.componentInstance.submitted.subscribe((value) => emitted.push(value));
    await fixture.whenStable();
  });

  it('renderiza título, campos, ações e links do design', () => {
    expect(host.querySelector('h1')?.textContent).toContain('Entrar');
    expect(host.textContent).toContain('Que bom te ver de novo! Acesse sua conta.');
    expect($('email-input')).toBeTruthy();
    expect($('password-input')).toBeTruthy();
    expect(host.textContent).toContain('Lembrar de mim');
    expect($('forgot-password-link')?.getAttribute('href')).toBe('/recuperar-senha');
    expect($('signup-link')?.getAttribute('href')).toBe('/cadastro');
    expect($('login-submit')?.textContent).toContain('Entrar no orkut');
  });

  it('usa autocomplete adequado para gerenciadores de senha', () => {
    expect($('email-input')?.getAttribute('autocomplete')).toBe('username');
    expect($('password-input')?.getAttribute('autocomplete')).toBe('current-password');
    expect($('password-input')?.getAttribute('type')).toBe('password');
  });

  it('não envia e exibe erros quando os campos estão vazios', async () => {
    await submit();

    expect(emitted).toHaveLength(0);
    expect(host.textContent).toContain('Informe seu e-mail.');
    expect(host.textContent).toContain('Informe sua senha.');
    expect(document.activeElement).toBe($('email-input'));
  });

  it('valida o formato do e-mail', async () => {
    type('email-input', 'nao-e-email');
    type('password-input', 'segredo');
    await submit();

    expect(emitted).toHaveLength(0);
    expect(host.textContent).toContain('Informe um e-mail válido.');
  });

  it('emite as credenciais normalizadas quando válido', async () => {
    type('email-input', '  paulo@orkut.com ');
    type('password-input', ' segredo com espaços ');
    $<HTMLInputElement>('remember-checkbox')!.querySelector('input')!.click();
    await submit();

    expect(emitted).toEqual([
      { email: 'paulo@orkut.com', password: ' segredo com espaços ', remember: true },
    ]);
  });

  it('alterna a visibilidade da senha com rótulo acessível', async () => {
    const toggle = $<HTMLButtonElement>('toggle-password')!;
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar senha');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    await fixture.whenStable();

    expect($('password-input')?.getAttribute('type')).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Ocultar senha');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('bloqueia o formulário e mostra spinner durante o envio', async () => {
    fixture.componentRef.setInput('pending', true);
    await fixture.whenStable();

    const button = $<HTMLButtonElement>('login-submit')!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Entrando…');
    expect(host.querySelector('mat-progress-spinner')).toBeTruthy();
    expect($<HTMLInputElement>('email-input')!.disabled).toBe(true);
  });

  it('exibe a mensagem de erro em um alerta focado', async () => {
    fixture.componentRef.setInput('errorMessage', 'E-mail ou senha inválidos.');
    await fixture.whenStable();

    const alert = $('login-error')!;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('E-mail ou senha inválidos.');
    expect(document.activeElement).toBe(alert);
  });

  it('escapa HTML vindo da mensagem de erro (XSS)', async () => {
    fixture.componentRef.setInput('errorMessage', '<img src=x onerror="alert(1)">');
    await fixture.whenStable();

    const alert = $('login-error')!;
    expect(alert.querySelector('img')).toBeNull();
    expect(alert.textContent).toContain('<img src=x onerror="alert(1)">');
  });
});
