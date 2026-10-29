import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Foto de perfil. Sem foto, desenha o placeholder 3D do design (busto em
 * esferas perolizadas sobre fundo cinza-azulado).
 */
@Component({
  selector: 'ok-profile-photo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.round]': 'round()' },
  template: `
    @if (src(); as url) {
      <img [src]="url" [alt]="alt()" class="photo" />
    } @else {
      <div
        class="photo placeholder"
        [attr.role]="alt() ? 'img' : null"
        [attr.aria-label]="alt() || null"
        [attr.aria-hidden]="alt() ? null : 'true'"
      >
        <span class="head"></span>
        <span class="body"></span>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: 20px;
    }

    :host(.round) {
      border-radius: 9999px;
    }

    .photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .placeholder {
      position: relative;
      background: linear-gradient(160deg, #e4e6ee 0%, #a9afc2 100%);
    }

    .head,
    .body {
      position: absolute;
      left: 50%;
      translate: -50% 0;
      border-radius: 9999px;
      background: radial-gradient(circle at 35% 30%, #fff 0%, #eceaf0 60%, #c9c6d2 100%);
      box-shadow: inset -6px -8px 14px rgb(110 104 122 / 35%);
    }

    .head {
      top: 20%;
      width: 29%;
      height: 29%;
    }

    .body {
      top: 55%;
      width: 68%;
      height: 68%;
    }
  `,
})
export class ProfilePhoto {
  readonly src = input<string | null>(null);
  readonly alt = input('Foto de perfil');
  readonly round = input(false);
}
