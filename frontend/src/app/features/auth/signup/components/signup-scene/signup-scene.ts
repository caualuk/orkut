import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ParallaxDirective } from '../../../../../shared/motion/parallax.directive';

/**
 * Cena decorativa de "Criar conta": cartões de vidro inclinados (comunidade,
 * amigos, fãs, scrap, depoimento, medidores e namoro) com parallax e flutuação.
 * Puramente visual (aria-hidden). No mobile só fica o cartão "248 amigos".
 */
@Component({
  selector: 'ok-signup-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ParallaxDirective],
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="blob blob--pink"></div>
    <div class="blob blob--lavender"></div>

    <div class="card c-community" style="--d: 14px; --r: -6deg">
      <span class="tile tile--pink">zZ</span>
      <span><b>Eu odeio acordar cedo</b><small>comunidade · 1,2 mi membros</small></span>
    </div>

    <div class="card c-friends" style="--d: 26px; --r: 4deg">
      <p class="flex justify-between"><b>amigos (248)</b><small class="pink">ver todos</small></p>
      <div class="grid">
        <span><i class="t t-pink"></i>Ana</span>
        <span><i class="t t-blue"></i>Lucas</span>
        <span><i class="t t-orange"></i>Juliana</span>
        <span><i class="t t-lavender"></i>Pedro</span>
        <span><i class="t t-green"></i>Mari</span>
        <span><i class="t t-more">+242</i>e mais</span>
      </div>
    </div>

    <div class="card c-mobile">
      <span class="dots"
        ><i class="t-pink"></i><i class="t-blue"></i><i class="t-orange"></i
        ><i class="t-lavender"></i
      ></span>
      <b>248 amigos</b><small>esperando você</small>
    </div>

    <div class="card c-fans" style="--d: 10px; --r: 3deg"><b>★&nbsp;&nbsp;+126 fãs</b></div>

    <div class="card c-meter" style="--d: 18px; --r: -4deg">
      <span>confiável <em>☺ ☺ ☺</em></span>
      <span>legal <em class="blue">❄ ❄ ❄</em></span>
      <span>sexy <em class="pink">♥ ♥ ♥</em></span>
    </div>

    <div class="card c-scrap" style="--d: 22px; --r: -5deg">
      <i class="t t-blue round"></i>
      <span><b>Lucas Braga</b><small>deixou um scrap pra você ♥</small></span>
    </div>

    <div class="card c-testimonial" style="--d: 16px; --r: 5deg">
      <p class="flex items-center gap-2">
        <i class="t t-green round sm"></i
        ><span><b>Mari Souza</b><small>escreveu um depoimento</small></span>
      </p>
      <p class="quote">“Amiga desde a 5ª série. Melhor pessoa do mundo, sem exagero!”</p>
      <p class="flex gap-2">
        <span class="pill pill--on">aceitar</span><span class="pill">ler depois</span>
      </p>
    </div>

    <div class="card c-dating" style="--d: 8px; --r: 1deg">
      <span class="dots"><i class="t-orange"></i><i class="t-lavender"></i></span>
      <small>Juliana e Pedro agora estão namorando</small>
      <b class="pink">♥</b>
    </div>
  `,
  styleUrl: './signup-scene.css',
})
export class SignupScene {}
