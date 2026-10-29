import { z } from 'zod';
import { LANGUAGES, RELATIONSHIPS, THEMES, VISIBILITIES } from './social.types.js';

/** Texto livre: espaços nas pontas removidos, quebras normalizadas, sem caracteres de controle. */
const text = (max: number, min = 0, label = 'Texto') =>
  z
    .string({ error: `${label} inválido.` })
    .transform((value) =>
      value
        .replace(/\r\n?/g, '\n')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim(),
    )
    .pipe(
      z
        .string()
        .min(min, min === 1 ? `${label} não pode ficar vazio.` : `${label} muito curto.`)
        .max(max, `${label} pode ter até ${max} caracteres.`),
    );

const line = (max: number, min = 0, label = 'Texto') =>
  text(max, min, label).transform((value) => value.replace(/\s+/g, ' '));

const NAME_PATTERN = /^[\p{L}\p{M}' -]*$/u;
const name = (label: string, min: number) =>
  line(40, min, label).pipe(
    z.string().regex(NAME_PATTERN, `${label} contém caracteres inválidos.`),
  );

const freeFields = z
  .record(z.string().max(30), line(120))
  .refine((r) => Object.keys(r).length <= 10, {
    message: 'Campos demais.',
  });

export const uuid = z.uuid({ error: 'Identificador inválido.' });

export const profileSchema = z
  .object({
    firstName: name('Nome', 1),
    lastName: name('Sobrenome', 0),
    gender: z.enum(['feminino', 'masculino', 'outro', 'nao-informar']).nullable(),
    relationship: z.enum(RELATIONSHIPS),
    birthday: z.iso
      .date({ error: 'Data inválida.' })
      .refine((value) => value >= '1900-01-01' && value <= new Date().toISOString().slice(0, 10), {
        message: 'Data inválida.',
      })
      .nullable(),
    city: line(80),
    country: line(60),
    about: text(500),
    interests: z.array(line(30, 1, 'Interesse')).max(20, 'Até 20 interesses.'),
    social: freeFields,
    contact: freeFields,
    professional: freeFields,
    personal: freeFields,
  })
  .partial()
  .strict();

export const settingsSchema = z
  .object({
    scrapVisibility: z.enum(VISIBILITIES),
    showRecentVisitors: z.boolean(),
    allowTestimonials: z.boolean(),
    appearOnline: z.boolean(),
    theme: z.enum(THEMES),
    language: z.enum(LANGUAGES),
    notifications: z
      .object({
        scraps: z.boolean(),
        testimonials: z.boolean(),
        friendRequests: z.boolean(),
        birthdays: z.boolean(),
      })
      .partial(),
  })
  .partial()
  .strict();

export const userTargetSchema = z.object({ userId: uuid });
export const bestFriendSchema = z.object({ userId: uuid, best: z.boolean() });
export const fanSchema = z.object({ userId: uuid, fan: z.boolean() });
export const searchSchema = z.object({ q: line(80) });

export const scrapSchema = z.object({ to: uuid, text: text(1000, 1, 'Recado') });
export const replySchema = z.object({ text: text(1000, 1, 'Resposta') });
export const messageSchema = z.object({ text: text(1000, 1, 'Mensagem') });
export const testimonialSchema = z.object({ to: uuid, text: text(1000, 1, 'Depoimento') });
export const statusSchema = z.object({ text: line(280, 1, 'Status') });

export const albumSchema = z.object({
  title: line(60, 1, 'Título'),
  visibility: z.enum(VISIBILITIES).default('somente-eu'),
});

export const feedItemSchema = z.object({
  item: z.string().regex(/^(status|fotos|comunidades|amigos):[0-9a-f:-]{8,110}$/, 'Item inválido.'),
});
export const feedCommentSchema = feedItemSchema.extend({ text: line(300, 1, 'Comentário') });

const ICONS = [
  'groups',
  'music_note',
  'local_cafe',
  'sports_esports',
  'movie',
  'menu_book',
  'pets',
  'sports_soccer',
  'travel_explore',
  'school',
  'code',
  'restaurant',
  'wb_sunny',
  'bedtime',
  'favorite',
  'palette',
  'photo_camera',
  'theater_comedy',
] as const;
export const COMMUNITY_ICONS = ICONS;

export const communitySchema = z.object({
  name: line(80, 3, 'Nome'),
  category: line(40, 1, 'Categoria'),
  about: text(1000),
  icon: z.enum(ICONS).default('groups'),
});

export const topicSchema = z.object({ title: line(120, 3, 'Título') });
export const pollSchema = z.object({
  question: line(160, 3, 'Pergunta'),
  options: z
    .array(line(60, 1, 'Opção'))
    .min(2, 'Pelo menos 2 opções.')
    .max(6, 'Até 6 opções.'),
});
export const voteSchema = z.object({ optionIndex: z.int().min(0).max(5) });
export const eventSchema = z.object({
  title: line(120, 3, 'Título'),
  startsAt: z.iso.datetime({ offset: true, error: 'Data inválida.' }),
  place: line(120),
});

/** Slug a partir do nome ("Eu odeio acordar cedo" → "eu-odeio-acordar-cedo"). */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
    .replace(/-+$/g, '');
}
