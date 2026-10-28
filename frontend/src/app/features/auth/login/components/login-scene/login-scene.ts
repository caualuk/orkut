import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ParallaxDirective } from '../../../../../shared/motion/parallax.directive';

/**
 * Cena 3D decorativa da tela de login: blobs de fundo, esferas, anel, estrela e
 * cartões flutuantes de vidro. Puramente visual (aria-hidden) e sem interação.
 */
@Component({
  selector: 'ok-login-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ParallaxDirective],
  host: { 'aria-hidden': 'true' },
  templateUrl: './login-scene.html',
  styleUrl: './login-scene.css',
})
export class LoginScene {}
