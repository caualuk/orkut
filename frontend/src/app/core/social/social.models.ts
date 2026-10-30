import type { Gender } from '../auth/auth.models';

/**
 * Modelos do domínio social (perfil, amigos, recados, mensagens, depoimentos,
 * álbuns, feeds e comunidades) consumidos pelas telas internas. Todos vêm da
 * API (`/api/social`), já com datas formatadas para exibição.
 */

/** Gradientes dos avatares/tiles 3D do design (ver `TONE_GRADIENTS`). */
export type Tone =
  | 'teal'
  | 'purple'
  | 'coral'
  | 'blue'
  | 'orange'
  | 'slate'
  | 'lavender'
  | 'green'
  | 'peach'
  | 'yellow'
  | 'pink'
  | 'gray';

export type { Gender };

export type Relationship =
  'solteiro' | 'namorando' | 'casado' | 'relacionamento-aberto' | 'nao-informar';

export type Visibility = 'todos' | 'amigos' | 'somente-eu';

export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  relationship: Relationship;
  birthday: string;
  city: string;
  country: string;
  about: string;
  interests: string[];
  social: { humor: string; style: string; pets: string; smoking: string; drinking: string };
  contact: { phone: string; website: string };
  professional: { education: string; company: string; role: string };
  photoUrl: string | null;
  fans: number;
  visits: { since: string; total: number; lastWeek: number; yesterday: number };
  recentVisitors: string[];
}

/** Campos comuns de qualquer pessoa exibida (amigo, autor, membro). */
export interface PersonRef {
  id: string;
  name: string;
  shortName: string;
  initials: string;
  tone: Tone;
  online: boolean;
  photoUrl: string | null;
}

export interface Friend extends PersonRef {
  bestFriend: boolean;
  mutualFriends: number;
  /** Faz aniversário hoje (data de nascimento informada no perfil). */
  birthdayToday: boolean;
}

export interface FriendRequest extends PersonRef {
  mutualFriends: number;
}

export interface Suggestion extends PersonRef {
  mutualFriends: number;
  requested: boolean;
  /** Já é amigo (resultado de busca). */
  friend?: boolean;
}

export interface Scrap {
  id: string;
  authorId: string;
  authorName: string;
  tone: Tone;
  photoUrl: string | null;
  /** Destinatário (para recados enviados pelo usuário). */
  toName?: string;
  text: string;
  createdAt: string;
  read: boolean;
  liked: boolean;
  likes: number;
  imageTone?: Tone;
  direction: 'recebido' | 'enviado';
  replies: string[];
}

export interface Message {
  id: string;
  fromMe: boolean;
  text: string;
  time: string;
  read?: boolean;
}

export interface Conversation {
  id: string;
  friendId: string;
  name: string;
  tone: Tone;
  photoUrl: string | null;
  online: boolean;
  typing: boolean;
  unread: number;
  lastActivity: string;
  messages: Message[];
}

export interface Testimonial {
  id: string;
  authorName: string;
  tone: Tone;
  photoUrl: string | null;
  text: string;
  date: string;
  likes: number;
  liked: boolean;
  status: 'recebido' | 'enviado' | 'pendente';
  /** Destinatário de um depoimento enviado. */
  toName?: string;
}

export interface Album {
  id: string;
  title: string;
  emoji?: string;
  tone: Tone;
  photos: number;
  visibility: Visibility;
  coverUrl: string | null;
}

export interface Photo {
  id: string;
  albumId: string;
  tone: Tone;
  url?: string;
  alt: string;
}

export type FeedKind = 'fotos' | 'comunidades' | 'amigos' | 'status';

export interface FeedComment {
  id: string;
  authorName: string;
  tone: Tone;
  photoUrl: string | null;
  text: string;
  time: string;
  /** Comentário recém-enviado (entra com animação). */
  fresh?: boolean;
}

export interface FeedItem {
  id: string;
  kind: FeedKind;
  actorName: string;
  tone: Tone;
  photoUrl: string | null;
  headline: string;
  time: string;
  source: string;
  photos?: Tone[];
  photoUrls?: string[];
  extraPhotos?: number;
  communityId?: string;
  status?: string;
  likes: number;
  liked: boolean;
  comments: number;
  commentList: FeedComment[];
}

export interface Community {
  /** Slug, usado nas rotas (`/comunidades/:id`). */
  id: string;
  /** Identificador do banco, usado nas ações. */
  dbId: string;
  name: string;
  icon: string;
  tone: Tone;
  category: string;
  members: string;
  memberCount: number;
  visibility: 'pública' | 'moderada';
  about: string;
  createdAt: string;
  owner: string;
  isOwner: boolean;
  language: string;
  location: string;
  joined: boolean;
  friendsInside: string[];
  related: string[];
  topics: Topic[];
  polls: Poll[];
  events: CommunityEvent[];
  /** Detalhes (tópicos, enquetes, eventos) já carregados da API. */
  loaded: boolean;
}

export interface Topic {
  id: string;
  title: string;
  author: string;
  tone: Tone;
  activity: string;
  replies: string;
  pinned?: boolean;
  isNew?: boolean;
}

export interface Poll {
  id: string;
  question: string;
  options: { label: string; votes: number }[];
  votedIndex: number | null;
}

export interface CommunityEvent {
  id: string;
  title: string;
  date: string;
  place: string;
  going: boolean;
}

export interface Settings {
  scrapVisibility: Visibility;
  showRecentVisitors: boolean;
  allowTestimonials: boolean;
  appearOnline: boolean;
  theme: 'claro' | 'escuro' | 'sistema';
  language: 'pt-BR' | 'en' | 'es';
  notifications: {
    scraps: boolean;
    testimonials: boolean;
    friendRequests: boolean;
    birthdays: boolean;
  };
}

/** Sugestões de interesses do "Editar perfil" (opções de UI, não dados de usuários). */
export const SUGGESTED_INTERESTS = ['Música', 'Viagens', 'Tecnologia', 'Café', 'Games'];

export const COMMUNITY_ICONS = [
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

export const GENDER_LABELS: Record<Gender, string> = {
  feminino: 'Feminino',
  masculino: 'Masculino',
  outro: 'Outro',
  'nao-informar': 'Prefiro não informar',
};

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  solteiro: 'Solteiro(a)',
  namorando: 'Namorando',
  casado: 'Casado(a)',
  'relacionamento-aberto': 'Relacionamento aberto',
  'nao-informar': 'Prefiro não informar',
};

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  todos: 'Todos',
  amigos: 'Somente amigos',
  'somente-eu': 'Somente eu',
};
