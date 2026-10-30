import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LikeButton } from './like-button';

@Component({
  imports: [LikeButton],
  template: `<ok-like-button
    [liked]="liked()"
    [count]="count()"
    subject="o recado"
    (toggled)="toggle()"
  />`,
})
class Host {
  readonly liked = signal(false);
  readonly count = signal(2);
  toggle() {
    this.count.update((c) => c + (this.liked() ? -1 : 1));
    this.liked.update((v) => !v);
  }
}

describe('LikeButton', () => {
  it('alterna, anima o coração e rola o contador para cima', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.getAttribute('aria-pressed')).toBe('false');
    // Nome acessível = texto visível + contexto só para leitores de tela.
    const name = button.textContent?.replace(/\s+/g, ' ').trim();
    expect(name).toMatch(/^Curtir o recado 2 , 2 curtidas$/);

    button.click();
    await Promise.resolve();
    await fixture.whenStable();

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.classList).toContain('is-popping');
    expect(button.querySelectorAll('.particle').length).toBe(8);
    expect(button.querySelector('.digit')?.classList).toContain('up');
    expect(button.textContent).toContain('3');
  });
});
