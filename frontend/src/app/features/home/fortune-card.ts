import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const FORTUNES = [
  'A sorte vem ao seu encontro',
  'Um velho amigo vai lembrar de você hoje',
  'Bons scraps chegam para quem escreve primeiro',
  'Hoje é um ótimo dia para entrar numa comunidade nova',
  'Uma conversa antiga vai render boas risadas',
  'Alguém está prestes a deixar um depoimento pra você',
  'Seu próximo reencontro está mais perto do que parece',
];

/** Índice estável por dia: a sorte muda uma vez a cada 24h. */
export function fortuneOfTheDay(date = new Date()): string {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const day = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86_400_000,
  );
  return FORTUNES[day % FORTUNES.length] ?? '';
}

/** Card escuro com esfera rosa: "Sorte de hoje" ou "Aniversários". */
@Component({
  selector: 'ok-fortune-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ok-dark-card px-6 py-6" [attr.aria-label]="eyebrow()">
      <div
        class="ok-sphere-pink absolute -top-6 -right-6 size-28 tab:-top-8 tab:size-36"
        aria-hidden="true"
      ></div>
      <div
        class="ok-sphere-pearl absolute right-[136px] bottom-3 hidden size-8 lg:block"
        aria-hidden="true"
      ></div>
      <p class="relative text-[11px] font-bold tracking-[0.18em] text-primary-soft uppercase">
        {{ eyebrow() }}
      </p>
      <p class="relative mt-2 max-w-[78%] text-lg leading-snug font-bold tab:text-xl">
        {{ message() || fortune }} <span aria-hidden="true">{{ emoji() }}</span>
      </p>
      <ng-content />
    </section>
  `,
})
export class FortuneCard {
  readonly eyebrow = input('Sorte de hoje');
  readonly message = input('');
  readonly emoji = input('✨');

  protected readonly fortune = fortuneOfTheDay();
}
