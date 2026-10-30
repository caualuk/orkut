import {
  compactNumber,
  firstNameOf,
  initialsOf,
  relativeTime,
  shortDate,
  toneFor,
} from './social.format';

describe('social.format', () => {
  const now = new Date(2026, 9, 29, 15, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('formata datas relativas como no orkut', () => {
    expect(relativeTime(ago(10_000), now)).toBe('agora');
    expect(relativeTime(ago(5 * 60_000), now)).toBe('há 5 min');
    expect(relativeTime(ago(2 * 3_600_000), now)).toBe('há 2 h');
    expect(relativeTime(new Date(2026, 9, 28, 20, 0).toISOString(), now)).toBe('ontem');
    expect(relativeTime(new Date(2026, 9, 25, 9, 0).toISOString(), now)).toBe('há 4 dias');
    expect(relativeTime(new Date(2025, 10, 14).toISOString(), now)).toBe(
      shortDate(new Date(2025, 10, 14).toISOString()),
    );
  });

  it('gera iniciais e primeiro nome', () => {
    expect(initialsOf('Ana Maria Teste')).toBe('AT');
    expect(initialsOf('Leo')).toBe('LE');
    expect(initialsOf('  ')).toBe('?');
    expect(firstNameOf('Ana Maria')).toBe('Ana');
  });

  it('usa a mesma cor para o mesmo id', () => {
    expect(toneFor('abc')).toBe(toneFor('abc'));
  });

  it('abrevia números grandes', () => {
    expect(compactNumber(12)).toBe('12');
    expect(compactNumber(1200)).toMatch(/^1,2\s?mil$/);
  });
});
