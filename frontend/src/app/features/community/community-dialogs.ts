import { inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { COMMUNITY_ICONS } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import {
  FormDialog,
  type FormDialogData,
  type FormDialogResult,
} from '../../shared/ui/form-dialog/form-dialog';

const ICON_LABELS: Record<(typeof COMMUNITY_ICONS)[number], string> = {
  groups: 'Pessoas',
  music_note: 'Música',
  local_cafe: 'Café',
  sports_esports: 'Games',
  movie: 'Filmes',
  menu_book: 'Livros',
  pets: 'Bichos',
  sports_soccer: 'Esportes',
  travel_explore: 'Viagens',
  school: 'Escola',
  code: 'Tecnologia',
  restaurant: 'Comida',
  wb_sunny: 'Sol',
  bedtime: 'Sono',
  favorite: 'Amor',
  palette: 'Arte',
  photo_camera: 'Fotografia',
  theater_comedy: 'Humor',
};

const DIALOG_SIZE = { width: '520px', maxWidth: 'calc(100vw - 32px)' };

/**
 * Ações de comunidade que abrem formulários (criar comunidade, enquete, evento).
 * Use dentro de um contexto de injeção (construtor/campo de componente).
 */
export function injectCommunityDialogs() {
  const dialog = inject(MatDialog);
  const store = inject(SocialStore);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  const open = (data: FormDialogData) =>
    firstValueFrom(
      dialog
        .open<FormDialog, FormDialogData, FormDialogResult>(FormDialog, { ...DIALOG_SIZE, data })
        .afterClosed(),
    );

  return {
    /** Cria a comunidade (o criador vira dono e primeiro membro) e abre a página dela. */
    async createCommunity(): Promise<void> {
      const photo = signal<File | null>(null);
      const result = await open({
        title: 'Criar comunidade',
        submitLabel: 'Criar comunidade',
        fields: [
          { key: 'photo', label: 'Foto', type: 'image', onImage: (file) => photo.set(file) },
          { key: 'name', label: 'Nome', type: 'text', required: true, minLength: 3, maxLength: 80 },
          {
            key: 'category',
            label: 'Categoria',
            type: 'text',
            required: true,
            maxLength: 40,
            placeholder: 'Ex.: Humor, Música, Games',
          },
          { key: 'about', label: 'Sobre', type: 'textarea', maxLength: 1000 },
          {
            key: 'icon',
            label: 'Ícone',
            type: 'select',
            options: COMMUNITY_ICONS.map((icon) => ({ value: icon, label: ICON_LABELS[icon] })),
          },
        ],
      });
      if (!result) return;
      const slug = await store.createCommunity({
        name: result['name'] ?? '',
        category: result['category'] ?? '',
        about: result['about'] ?? '',
        icon: result['icon'] ?? 'groups',
      });
      if (!slug) return;
      const file = photo();
      const photoSent = !file || (await store.uploadCommunityPhoto(slug, file));
      snackBar.open(
        photoSent ? 'Comunidade criada!' : 'Comunidade criada, mas a foto não foi enviada.',
        'OK',
        { duration: 4000 },
      );
      await router.navigate(['/comunidades', slug]);
    },

    async createPoll(communityId: string): Promise<void> {
      const result = await open({
        title: 'Nova enquete',
        submitLabel: 'Criar enquete',
        fields: [
          {
            key: 'question',
            label: 'Pergunta',
            type: 'text',
            required: true,
            minLength: 3,
            maxLength: 160,
          },
          {
            key: 'options',
            label: 'Opções',
            type: 'textarea',
            required: true,
            hint: 'Uma opção por linha (de 2 a 6).',
          },
        ],
      });
      if (!result) return;
      const options = (result['options'] ?? '')
        .split('\n')
        .map((line) => line.trim().slice(0, 60))
        .filter(Boolean);
      if (options.length < 2 || options.length > 6) {
        snackBar.open('A enquete precisa de 2 a 6 opções.', 'OK', { duration: 4000 });
        return;
      }
      store.createPoll(communityId, result['question'] ?? '', options);
      snackBar.open('Enquete criada!', 'OK', { duration: 3000 });
    },

    async createEvent(communityId: string): Promise<void> {
      const result = await open({
        title: 'Novo evento',
        submitLabel: 'Criar evento',
        fields: [
          {
            key: 'title',
            label: 'Nome do evento',
            type: 'text',
            required: true,
            minLength: 3,
            maxLength: 120,
          },
          { key: 'startsAt', label: 'Quando', type: 'datetime-local', required: true },
          { key: 'place', label: 'Onde', type: 'text', maxLength: 120, placeholder: 'Ex.: Online' },
        ],
      });
      if (!result) return;
      const startsAt = new Date(result['startsAt'] ?? '');
      if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) {
        snackBar.open('Escolha uma data futura para o evento.', 'OK', { duration: 4000 });
        return;
      }
      store.createEvent(communityId, {
        title: result['title'] ?? '',
        startsAt: startsAt.toISOString(),
        place: result['place'] ?? '',
      });
      snackBar.open('Evento criado!', 'OK', { duration: 3000 });
    },
  };
}
