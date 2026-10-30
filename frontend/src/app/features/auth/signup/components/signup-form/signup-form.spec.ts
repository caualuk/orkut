import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { SignupForm, type SignupSubmission } from './signup-form';

/** Acesso aos grupos protegidos para preencher os mat-select sem overlay. */
interface FormInternals {
  general: FormGroup;
  details: FormGroup;
}

describe('SignupForm (cadastro em 2 etapas)', () => {
  let fixture: ComponentFixture<SignupForm>;
  let host: HTMLElement;
  let emitted: SignupSubmission[];

  const $ = <T extends HTMLElement>(testId: string) =>
    host.querySelector<T>(`[data-testid="${testId}"]`);
  const internals = () => fixture.componentInstance as unknown as FormInternals;

  const click = async (testId: string) => {
    $<HTMLButtonElement>(testId)!.click();
    await fixture.whenStable();
  };

  const fillStepOne = async () => {
    internals().general.setValue({
      firstName: ' Nina ',
      lastName: 'Costa',
      email: 'nina@orkut.com',
      password: 'saudade2004',
      gender: 'feminino',
      relationship: 'solteiro',
      birthDate: '1995-03-12',
      city: ' São Paulo, SP ',
    });
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignupForm],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SignupForm);
    host = fixture.nativeElement;
    emitted = [];
    fixture.componentInstance.submitted.subscribe((value) => emitted.push(value));
    await fixture.whenStable();
  });

  it('começa na etapa 1 com as informações gerais, e-mail e senha', () => {
    expect($('signup-progress')?.textContent).toContain('Etapa 1 de 2');
    expect($('signup-step-1')).toBeTruthy();
    expect($('signup-step-2')).toBeNull();
    for (const id of ['first-name', 'last-name', 'gender', 'relationship', 'birth-date', 'city']) {
      expect($(id), id).toBeTruthy();
    }
    expect($('signup-email')).toBeTruthy();
    expect($('signup-password')).toBeTruthy();
  });

  it('não avança com a etapa 1 incompleta e mostra os erros', async () => {
    await click('signup-next');

    expect($('signup-step-2')).toBeNull();
    expect(host.textContent).toContain('Informe seu nome.');
    expect(host.textContent).toContain('Informe sua cidade.');
    expect(host.textContent).toContain('Escolha uma opção.');
  });

  it('avança para a etapa 2 (foto + descrição) no mesmo card e permite voltar', async () => {
    await fillStepOne();
    await click('signup-next');

    expect($('signup-progress')?.textContent).toContain('Etapa 2 de 2');
    expect($('signup-photo')).toBeTruthy();
    expect($('signup-about')).toBeTruthy();

    await click('signup-back');
    expect($('signup-step-1')).toBeTruthy();
    expect(internals().general.value.firstName).toBe(' Nina ');
  });

  it('exige o aceite dos termos e emite dados normalizados + foto', async () => {
    await fillStepOne();
    await click('signup-next');

    await click('signup-submit');
    expect(emitted).toHaveLength(0);
    expect(host.textContent).toContain('É preciso aceitar os termos');

    const photo = new File(['x'], 'eu.png', { type: 'image/png' });
    const input = $<HTMLInputElement>('signup-photo')!;
    Object.defineProperty(input, 'files', { value: [photo] });
    input.dispatchEvent(new Event('change'));
    internals().details.setValue({ about: '  Fã de café.  ', acceptTerms: true });
    await click('signup-submit');

    expect(emitted).toEqual([
      {
        data: {
          firstName: 'Nina',
          lastName: 'Costa',
          email: 'nina@orkut.com',
          password: 'saudade2004',
          birthDate: '1995-03-12',
          gender: 'feminino',
          relationship: 'solteiro',
          city: 'São Paulo, SP',
          about: 'Fã de café.',
          acceptTerms: true,
        },
        photo,
      },
    ]);
  });

  it('recusa foto que não seja JPG/PNG até 5 MB', async () => {
    await fillStepOne();
    await click('signup-next');

    const input = $<HTMLInputElement>('signup-photo')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'anim.gif', { type: 'image/gif' })],
    });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect($('photo-error')?.textContent).toContain('JPG ou PNG');
  });

  it('volta para a etapa 1 quando a API recusa o e-mail', async () => {
    await fillStepOne();
    await click('signup-next');

    fixture.componentRef.setInput('errorMessage', 'Este e-mail já está em uso. Tente entrar.');
    await fixture.whenStable();

    expect($('signup-step-1')).toBeTruthy();
    expect($('signup-error')?.textContent).toContain('já está em uso');
  });
});
