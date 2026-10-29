import { fortuneOfTheDay } from '../features/home/fortune-card';
import { normalize } from './global-search/global-search';
import { PRIMARY_NAV, PROFILE_MENU } from './navigation';
import { isNavItemActive } from './route-state';

const profileItem = PROFILE_MENU[0]![0]!;
const scrapsItem = PROFILE_MENU[0]![1]!;
const homeItem = PRIMARY_NAV[0]!;

describe('isNavItemActive', () => {
  it('"Perfil" fica ativo na Home e nas telas de perfil', () => {
    expect(isNavItemActive(profileItem, '/home')).toBe(true);
    expect(isNavItemActive(profileItem, '/perfil/editar')).toBe(true);
    expect(isNavItemActive(profileItem, '/recados')).toBe(false);
  });

  it('itens comuns ativam na rota, nas filhas e ignoram query/fragment', () => {
    expect(isNavItemActive(scrapsItem, '/recados?para=nina')).toBe(true);
    expect(isNavItemActive(scrapsItem, '/recados/1')).toBe(true);
    expect(isNavItemActive(scrapsItem, '/recadosx')).toBe(false);
  });

  it('"Início" só ativa na rota exata', () => {
    expect(isNavItemActive(homeItem, '/home')).toBe(true);
    expect(isNavItemActive(homeItem, '/home/outra')).toBe(false);
  });
});

describe('normalize', () => {
  it('remove acentos, caixa e espaços das pontas', () => {
    expect(normalize('  Café É Vida ')).toBe('cafe e vida');
  });
});

describe('fortuneOfTheDay', () => {
  it('é estável no mesmo dia e muda no seguinte', () => {
    const morning = new Date(2026, 9, 29, 8);
    const night = new Date(2026, 9, 29, 23);
    const tomorrow = new Date(2026, 9, 30, 8);
    expect(fortuneOfTheDay(morning)).toBe(fortuneOfTheDay(night));
    expect(fortuneOfTheDay(morning)).not.toBe(fortuneOfTheDay(tomorrow));
  });
});
