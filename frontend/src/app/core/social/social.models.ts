import type { Gender } from '../auth/auth.models';

/**
 * Modelos do domínio social (perfil, amigos, recados, mensagens, depoimentos,
 * álbuns, feeds e comunidades) consumidos pelas telas internas.
 */

/** Gradientes dos avatares/tiles 3D do design (ver `AVATAR_GRADIENTS`). */
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
  personal: { music: string; movies: string; books: string; passions: string };
  photoUrl: string | null;
  fans: number;
  visits: { since: string; lastWeek: number; yesterday: number };
  recentVisitors: string[];
}

export interface Friend {
  id: string;
  name: string;
  shortName: string;
  initials: string;
  tone: Tone;
  online: boolean;
  bestFriend: boolean;
  mutualFriends: number;
}

export interface FriendRequest {
  id: string;
  name: string;
  initials: string;
  tone: Tone;
  mutualFriends: number;
}

export interface Suggestion {
  id: string;
  name: string;
  tone: Tone;
  mutualFriends: number;
  requested: boolean;
}

export interface Scrap {
  id: string;
  authorId: string;
  authorName: string;
  tone: Tone;
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
}

export interface Photo {
  id: string;
  tone: Tone;
  /** URL local (object URL) de uma foto adicionada nesta sessão. */
  url?: string;
  alt: string;
}

export type FeedKind = 'fotos' | 'comunidades' | 'amigos' | 'status';

export interface FeedItem {
  id: string;
  kind: FeedKind;
  actorName: string;
  tone: Tone;
  headline: string;
  time: string;
  source: string;
  photos?: Tone[];
  extraPhotos?: number;
  communityId?: string;
  status?: string;
  likes: number;
  liked: boolean;
  comments: number;
}

export interface Community {
  id: string;
  name: string;
  icon: string;
  tone: Tone;
  category: string;
  members: string;
  visibility: 'pública' | 'moderada';
  about: string;
  createdAt: string;
  owner: string;
  language: string;
  location: string;
  joined: boolean;
  friendsInside: string[];
  related: string[];
  topics: Topic[];
  polls: Poll[];
  events: CommunityEvent[];
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
