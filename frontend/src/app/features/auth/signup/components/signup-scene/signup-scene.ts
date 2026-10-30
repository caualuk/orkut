import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ParallaxDirective } from '../../../../../shared/motion/parallax.directive';

/**
 * Cena decorativa de "Criar conta": cartões de vidro inclinados (comunidade,
 * amigos, fãs, scrap, depoimento, medidores e feed) com parallax e flutuação, sem
 * pessoas ou números fictícios.
 * Puramente visual (aria-hidden). No mobile só fica o cartão "seus amigos".
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
      <span><b>Suas comunidades</b><small>crie ou entre nas que você curte</small></span>
    </div>

    <div class="card c-friends" style="--d: 26px; --r: 4deg">
      <p class="flex justify-between"><b>seus amigos</b><small class="pink">ver todos</small></p>
      <div class="grid">
        <span><i class="t t-pink"></i>escola</span>
        <span><i class="t t-blue"></i>faculdade</span>
        <span><i class="t t-orange"></i>trabalho</span>
        <span><i class="t t-lavender"></i>família</span>
        <span><i class="t t-green"></i>vizinhos</span>
        <span><i class="t t-more">+</i>e mais</span>
      </div>
    </div>

    <div class="card c-mobile">
      <span class="dots"
        ><i class="t-pink"></i><i class="t-blue"></i><i class="t-orange"></i
        ><i class="t-lavender"></i
      ></span>
      <b>seus amigos</b><small>estão te esperando</small>
    </div>

    <div class="card c-fans" style="--d: 10px; --r: 3deg"><b>★&nbsp;&nbsp;seus fãs</b></div>

    <div class="card c-meter" style="--d: 18px; --r: -4deg">
      <span>confiável <em>☺ ☺ ☺</em></span>
      <span>legal <em class="blue">❄ ❄ ❄</em></span>
      <span>sexy <em class="pink">♥ ♥ ♥</em></span>
    </div>

    <div class="card c-scrap" style="--d: 22px; --r: -5deg">
      <i class="t t-blue round"></i>
      <span><b>Novo scrap</b><small>seus amigos estão te esperando ♥</small></span>
    </div>

    <div class="card c-testimonial" style="--d: 16px; --r: 5deg">
      <p class="flex items-center gap-2">
        <i class="t t-green round sm"></i
        ><span><b>Novo depoimento</b><small>de um amigo seu</small></span>
      </p>
      <p class="quote">“O que seus amigos dizem sobre você aparece aqui.”</p>
      <p class="flex gap-2">
        <span class="pill pill--on">aceitar</span><span class="pill">ler depois</span>
      </p>
    </div>

    <div class="card c-dating" style="--d: 8px; --r: 1deg">
      <span class="dots"><i class="t-orange"></i><i class="t-lavender"></i></span>
      <small>novidades dos seus amigos no feed</small>
      <b class="pink">♥</b>
    </div>
  `,
  styleUrl: './signup-scene.css',
})
export class SignupScene {}
