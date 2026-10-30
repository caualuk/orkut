import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { InterestsPage, MAX_INTERESTS } from './interests-page';

describe('InterestsPage (onboarding)', () => {
  let fixture: ComponentFixture<InterestsPage>;
  let host: HTMLElement;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  const $ = <T extends HTMLElement>(testId: string) =>
    host.querySelector<T>(`[data-testid="${testId}"]`);
  const chip = (label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('[data-testid="interest-options"] button')].find(
      (button) => button.textContent?.trim().endsWith(label),
    )!;
  const pick = async (...labels: string[]) => {
    for (const label of labels) chip(label).click();
    await fixture.whenStable();
  };
  const addCustom = async (value: string) => {
    const input = $<HTMLInputElement>('custom-interest')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    $<HTMLButtonElement>('add-interest')!.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterestsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InterestsPage);
    host = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('só libera "Continuar" com ao menos 3 interesses', async () => {
    const save = $<HTMLButtonElement>('save-interests')!;
    expect(save.disabled).toBe(true);

    await pick('Música', 'Café');
    expect(save.disabled).toBe(true);
    expect($('interest-count')?.textContent).toContain('faltam 1');

    await pick('Games');
    expect(save.disabled).toBe(false);
    expect(chip('Games').getAttribute('aria-pressed')).toBe('true');
  });

  it('adiciona interesse livre já marcado, sem duplicar (ignora caixa)', async () => {
    await addCustom('  Skate  ');
    expect(chip('Skate').getAttribute('aria-pressed')).toBe('true');

    await addCustom('música');
    const musicChips = [...host.querySelectorAll('[data-testid="interest-options"] button')].filter(
      (b) => b.textContent?.toLowerCase().includes('música'),
    );
    expect(musicChips).toHaveLength(1);
    expect(chip('Música').getAttribute('aria-pressed')).toBe('true');
  });

  it(`limita a ${MAX_INTERESTS} interesses`, async () => {
    for (let i = 0; i < MAX_INTERESTS + 2; i++) await addCustom(`Interesse ${i}`);
    expect($('interest-count')?.textContent).toContain(`${MAX_INTERESTS} de ${MAX_INTERESTS}`);
    expect($<HTMLInputElement>('custom-interest')!.disabled).toBe(true);
  });

  it('salva os interesses no perfil e segue para a Home', async () => {
    await pick('Música', 'Café', 'Games');
    $<HTMLButtonElement>('save-interests')!.click();

    const req = http.expectOne('/api/social/profile');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ interests: ['Música', 'Café', 'Games'] });
    expect(req.request.withCredentials).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/home');
  });

  it('mostra o erro da API e permanece na tela', async () => {
    await pick('Música', 'Café', 'Games');
    $<HTMLButtonElement>('save-interests')!.click();
    http
      .expectOne('/api/social/profile')
      .flush(
        { error: { code: 'BAD_REQUEST', message: 'Dados inválidos.' } },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    expect($('interests-error')?.textContent).toContain('Dados inválidos.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('"Pular por agora" vai para a Home sem chamar a API', async () => {
    $<HTMLButtonElement>('skip-interests')!.click();
    expect(navigate).toHaveBeenCalledWith('/home');
  });
});
