import { FormControl } from '@angular/forms';
import { passwordStrength } from './password-strength';
import { birthDateRule, localIsoDate } from './signup-form';

describe('passwordStrength', () => {
  it('vazia não pontua', () => {
    expect(passwordStrength('')).toEqual({ score: 0, label: '' });
  });

  it.each([
    ['abc', 1],
    ['saudade2004', 2],
    ['Saudade2004', 3],
    ['Saudade#2004!', 4],
  ])('"%s" → %i', (password, score) => {
    expect(passwordStrength(password).score).toBe(score);
  });
});

describe('birthDateRule', () => {
  const check = (value: string) => birthDateRule(new FormControl(value, { nonNullable: true }));
  const yearsAgo = (years: number) => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    return localIsoDate(date);
  };

  it('usa a data local, não a UTC (às 23h de 29/10 ainda é dia 29)', () => {
    expect(localIsoDate(new Date(2026, 9, 29, 23, 30))).toBe('2026-10-29');
    expect(localIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('é opcional', () => {
    expect(check('')).toBeNull();
  });

  it('aceita quem tem 13 anos ou mais', () => {
    expect(check(yearsAgo(13))).toBeNull();
    expect(check('1994-03-12')).toBeNull();
  });

  it('recusa menores de 13 anos e datas implausíveis', () => {
    expect(check(yearsAgo(12))).toEqual({ minAge: true });
    expect(check('1899-12-31')).toEqual({ birthDate: true });
  });
});
