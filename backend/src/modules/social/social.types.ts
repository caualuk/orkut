/**
 * Contratos da API social. Tudo vem de usuários reais (app.users) e das tabelas
 * da migration 003; datas trafegam em ISO 8601 e o frontend formata.
 */

export const RELATIONSHIPS = [
  'solteiro',
  'namorando',
  'casado',
  'relacionamento-aberto',
  'nao-informar',
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const VISIBILITIES = ['todos', 'amigos', 'somente-eu'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const THEMES = ['claro', 'escuro', 'sistema'] as const;
export const LANGUAGES = ['pt-BR', 'en', 'es'] as const;

/** Pessoa como aparece em listas (amigos, autores, membros). */
export interface PersonDto {
  id: string;
  name: string;
  online: boolean;
  hasPhoto: boolean;
}

export interface ProfileDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: string;
  relationship: Relationship;
  birthday: string | null;
  city: string;
  country: string;
  about: string;
  interests: string[];
  social: Record<string, string>;
  contact: Record<string, string>;
  professional: Record<string, string>;
  personal: Record<string, string>;
  hasPhoto: boolean;
  fans: number;
  memberSince: string;
  visits: { total: number; lastWeek: number; yesterday: number };
  recentVisitors: PersonDto[];
}

export interface SettingsDto {
  scrapVisibility: Visibility;
  showRecentVisitors: boolean;
  allowTestimonials: boolean;
  appearOnline: boolean;
  theme: (typeof THEMES)[number];
  language: (typeof LANGUAGES)[number];
  notifications: {
    scraps: boolean;
    testimonials: boolean;
    friendRequests: boolean;
    birthdays: boolean;
  };
}

export const DEFAULT_SETTINGS: SettingsDto = {
  scrapVisibility: 'amigos',
  showRecentVisitors: true,
  allowTestimonials: true,
  appearOnline: true,
  theme: 'claro',
  language: 'pt-BR',
  notifications: { scraps: true, testimonials: true, friendRequests: true, birthdays: true },
};

export interface FriendDto extends PersonDto {
  bestFriend: boolean;
  mutualFriends: number;
  birthdayToday: boolean;
}

export interface FriendRequestDto extends PersonDto {
  mutualFriends: number;
  createdAt: string;
}

export interface SuggestionDto extends PersonDto {
  mutualFriends: number;
  requested: boolean;
}

export interface ScrapDto {
  id: string;
  author: PersonDto;
  recipient: PersonDto;
  text: string;
  createdAt: string;
  read: boolean;
  liked: boolean;
  likes: number;
  direction: 'recebido' | 'enviado';
  /** Respostas que o usuário deixou no perfil do autor. */
  replies: string[];
}

export interface MessageDto {
  id: string;
  fromMe: boolean;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface ConversationDto {
  person: PersonDto;
  unread: number;
  lastActivity: string;
  messages: MessageDto[];
}

export interface TestimonialDto {
  id: string;
  author: PersonDto;
  recipient: PersonDto;
  text: string;
  createdAt: string;
  likes: number;
  liked: boolean;
  status: 'recebido' | 'enviado' | 'pendente';
}

export interface AlbumDto {
  id: string;
  title: string;
  visibility: Visibility;
  photos: number;
  coverPhotoId: string | null;
  createdAt: string;
}

export interface PhotoDto {
  id: string;
  albumId: string;
  caption: string;
  createdAt: string;
}

export type FeedKind = 'fotos' | 'comunidades' | 'amigos' | 'status';

export interface FeedItemDto {
  id: string;
  kind: FeedKind;
  actor: PersonDto;
  createdAt: string;
  /** fotos */
  albumTitle?: string;
  photoIds?: string[];
  photoCount?: number;
  /** comunidades */
  community?: CommunitySummaryDto;
  /** amigos */
  friend?: PersonDto;
  /** status */
  status?: string;
  likes: number;
  liked: boolean;
  comments: number;
  /** Comentários mais recentes (até 20), do mais antigo ao mais novo. */
  commentList: FeedCommentDto[];
}

export interface FeedCommentDto {
  id: string;
  author: PersonDto;
  text: string;
  createdAt: string;
}

export interface CommunitySummaryDto {
  id: string;
  slug: string;
  name: string;
  icon: string;
  category: string;
  members: number;
  visibility: 'pública' | 'moderada';
  joined: boolean;
  hasPhoto: boolean;
}

export interface TopicDto {
  id: string;
  title: string;
  author: PersonDto;
  pinned: boolean;
  replies: number;
  createdAt: string;
  lastActivity: string;
}

export interface PollDto {
  id: string;
  question: string;
  options: { label: string; votes: number }[];
  votedIndex: number | null;
}

export interface EventDto {
  id: string;
  title: string;
  startsAt: string;
  place: string;
  attendees: number;
  going: boolean;
}

export interface CommunityDetailDto extends CommunitySummaryDto {
  about: string;
  createdAt: string;
  owner: PersonDto;
  language: string;
  location: string;
  friendsInside: PersonDto[];
  related: CommunitySummaryDto[];
  topics: TopicDto[];
  polls: PollDto[];
  events: EventDto[];
}

/** Tudo o que as telas internas precisam ao abrir (um único GET). */
export interface SocialStateDto {
  profile: ProfileDto;
  settings: SettingsDto;
  friends: FriendDto[];
  friendRequests: FriendRequestDto[];
  suggestions: SuggestionDto[];
  scraps: ScrapDto[];
  conversations: ConversationDto[];
  testimonials: TestimonialDto[];
  albums: AlbumDto[];
  photos: PhotoDto[];
  feed: FeedItemDto[];
  communities: CommunitySummaryDto[];
}
