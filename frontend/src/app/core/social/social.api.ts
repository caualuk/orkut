import type { Gender } from '../auth/auth.models';
import {
  clockTime,
  compactNumber,
  eventDate,
  firstNameOf,
  initialsOf,
  monthYear,
  relativeTime,
  shortDate,
  toneFor,
} from './social.format';
import type {
  Album,
  Community,
  Conversation,
  FeedComment,
  FeedItem,
  Friend,
  FriendRequest,
  PersonRef,
  Photo,
  Profile,
  Relationship,
  Scrap,
  Settings,
  Suggestion,
  Testimonial,
  Visibility,
} from './social.models';

/** Contratos de `/api/social` (espelham `backend/src/modules/social/social.types.ts`). */

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
  gender: Gender;
  relationship: Relationship;
  birthday: string | null;
  city: string;
  country: string;
  about: string;
  interests: string[];
  social: Record<string, string>;
  contact: Record<string, string>;
  professional: Record<string, string>;
  hasPhoto: boolean;
  fans: number;
  memberSince: string;
  visits: { total: number; lastWeek: number; yesterday: number };
  recentVisitors: PersonDto[];
}

export interface FriendDto extends PersonDto {
  bestFriend: boolean;
  mutualFriends: number;
  birthdayToday: boolean;
}
export interface FriendRequestDto extends PersonDto {
  mutualFriends: number;
}
export interface SuggestionDto extends PersonDto {
  mutualFriends: number;
  requested: boolean;
  friend?: boolean;
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
  replies: string[];
}

export interface ConversationDto {
  person: PersonDto;
  unread: number;
  lastActivity: string;
  messages: { id: string; fromMe: boolean; text: string; createdAt: string; read: boolean }[];
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
}

export interface PhotoDto {
  id: string;
  albumId: string;
  caption: string;
}

export interface FeedItemDto {
  id: string;
  kind: FeedItem['kind'];
  actor: PersonDto;
  createdAt: string;
  albumTitle?: string;
  photoIds?: string[];
  photoCount?: number;
  community?: CommunitySummaryDto;
  friend?: PersonDto;
  status?: string;
  likes: number;
  liked: boolean;
  comments: number;
  commentList: { id: string; author: PersonDto; text: string; createdAt: string }[];
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
}

export interface CommunityDetailDto extends CommunitySummaryDto {
  about: string;
  createdAt: string;
  owner: PersonDto;
  language: string;
  location: string;
  friendsInside: PersonDto[];
  related: CommunitySummaryDto[];
  topics: {
    id: string;
    title: string;
    author: PersonDto;
    pinned: boolean;
    replies: number;
    createdAt: string;
    lastActivity: string;
  }[];
  polls: {
    id: string;
    question: string;
    options: { label: string; votes: number }[];
    votedIndex: number | null;
  }[];
  events: {
    id: string;
    title: string;
    startsAt: string;
    place: string;
    attendees: number;
    going: boolean;
  }[];
}

export interface SocialStateDto {
  profile: ProfileDto;
  settings: Settings;
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

// ── Mapeamento DTO → modelo de tela ──────────────────────────────────────────

export const userPhotoUrl = (base: string, id: string) => `${base}/users/${id}/photo`;
export const photoUrl = (base: string, id: string) => `${base}/photos/${id}`;

export function toPerson(base: string, dto: PersonDto): PersonRef {
  return {
    id: dto.id,
    name: dto.name,
    shortName: firstNameOf(dto.name),
    initials: initialsOf(dto.name),
    tone: toneFor(dto.id),
    online: dto.online,
    photoUrl: dto.hasPhoto ? userPhotoUrl(base, dto.id) : null,
  };
}

export function toProfile(base: string, dto: ProfileDto, photoVersion: number): Profile {
  const field = (record: Record<string, string>, key: string) => record[key] ?? '';
  return {
    id: dto.id,
    firstName: dto.firstName,
    lastName: dto.lastName,
    gender: dto.gender,
    relationship: dto.relationship,
    birthday: dto.birthday ?? '',
    city: dto.city,
    country: dto.country,
    about: dto.about,
    interests: dto.interests,
    social: {
      humor: field(dto.social, 'humor'),
      style: field(dto.social, 'style'),
      pets: field(dto.social, 'pets'),
      smoking: field(dto.social, 'smoking'),
      drinking: field(dto.social, 'drinking'),
    },
    contact: { phone: field(dto.contact, 'phone'), website: field(dto.contact, 'website') },
    professional: {
      education: field(dto.professional, 'education'),
      company: field(dto.professional, 'company'),
      role: field(dto.professional, 'role'),
    },
    // `v` força o navegador a buscar a foto nova depois de um upload.
    photoUrl: dto.hasPhoto ? `${userPhotoUrl(base, dto.id)}?v=${photoVersion}` : null,
    fans: dto.fans,
    visits: { since: monthYear(dto.memberSince), ...dto.visits },
    recentVisitors: dto.recentVisitors.map((v) => firstNameOf(v.name)),
  };
}

export function toFriend(base: string, dto: FriendDto): Friend {
  return {
    ...toPerson(base, dto),
    bestFriend: dto.bestFriend,
    mutualFriends: dto.mutualFriends,
    birthdayToday: dto.birthdayToday,
  };
}

export function toFriendRequest(base: string, dto: FriendRequestDto): FriendRequest {
  return { ...toPerson(base, dto), mutualFriends: dto.mutualFriends };
}

export function toSuggestion(base: string, dto: SuggestionDto): Suggestion {
  return {
    ...toPerson(base, dto),
    mutualFriends: dto.mutualFriends,
    requested: dto.requested,
    friend: dto.friend,
  };
}

export function toScrap(base: string, dto: ScrapDto): Scrap {
  const author = toPerson(base, dto.author);
  return {
    id: dto.id,
    authorId: dto.author.id,
    authorName: dto.author.name,
    tone: author.tone,
    photoUrl: author.photoUrl,
    toName: dto.direction === 'enviado' ? dto.recipient.name : undefined,
    text: dto.text,
    createdAt: relativeTime(dto.createdAt),
    read: dto.read,
    liked: dto.liked,
    likes: dto.likes,
    direction: dto.direction,
    replies: dto.replies,
  };
}

export function toConversation(base: string, dto: ConversationDto): Conversation {
  const person = toPerson(base, dto.person);
  const last = new Date(dto.lastActivity);
  const today = new Date().toDateString() === last.toDateString();
  return {
    id: person.id,
    friendId: person.id,
    name: person.name,
    tone: person.tone,
    photoUrl: person.photoUrl,
    online: person.online,
    typing: false,
    unread: dto.unread,
    lastActivity: today ? clockTime(dto.lastActivity) : relativeTime(dto.lastActivity),
    messages: dto.messages.map((m) => ({
      id: m.id,
      fromMe: m.fromMe,
      text: m.text,
      time: clockTime(m.createdAt),
      read: m.fromMe ? m.read : undefined,
    })),
  };
}

export function toTestimonial(base: string, dto: TestimonialDto): Testimonial {
  const other = dto.status === 'enviado' ? dto.recipient : dto.author;
  const person = toPerson(base, other);
  return {
    id: dto.id,
    authorName: dto.author.name,
    tone: person.tone,
    photoUrl: person.photoUrl,
    text: dto.text,
    date: shortDate(dto.createdAt),
    likes: dto.likes,
    liked: dto.liked,
    status: dto.status,
    toName: dto.status === 'enviado' ? dto.recipient.name : undefined,
  };
}

export function toAlbum(base: string, dto: AlbumDto): Album {
  return {
    id: dto.id,
    title: dto.title,
    tone: toneFor(dto.id),
    photos: dto.photos,
    visibility: dto.visibility,
    coverUrl: dto.coverPhotoId ? photoUrl(base, dto.coverPhotoId) : null,
  };
}

export function toPhoto(base: string, dto: PhotoDto): Photo {
  return {
    id: dto.id,
    albumId: dto.albumId,
    tone: toneFor(dto.id),
    url: photoUrl(base, dto.id),
    alt: dto.caption || 'Foto do álbum',
  };
}

export function toFeedComment(base: string, dto: FeedItemDto['commentList'][number]): FeedComment {
  const author = toPerson(base, dto.author);
  return {
    id: dto.id,
    authorName: author.name,
    tone: author.tone,
    photoUrl: author.photoUrl,
    text: dto.text,
    time: relativeTime(dto.createdAt),
  };
}

export function toFeedItem(base: string, dto: FeedItemDto): FeedItem {
  const actor = toPerson(base, dto.actor);
  const common = {
    id: dto.id,
    kind: dto.kind,
    actorName: actor.name,
    tone: actor.tone,
    photoUrl: actor.photoUrl,
    time: relativeTime(dto.createdAt),
    likes: dto.likes,
    liked: dto.liked,
    comments: dto.comments,
    commentList: dto.commentList.map((c) => toFeedComment(base, c)),
  };
  switch (dto.kind) {
    case 'fotos': {
      const count = dto.photoCount ?? 0;
      const ids = dto.photoIds ?? [];
      return {
        ...common,
        headline: `adicionou ${count} ${count === 1 ? 'foto' : 'fotos'} ao álbum "${dto.albumTitle ?? ''}"`,
        source: 'Álbum',
        photos: ids.map((id) => toneFor(id)),
        photoUrls: ids.map((id) => photoUrl(base, id)),
        extraPhotos: Math.max(0, count - ids.length),
      };
    }
    case 'comunidades':
      return {
        ...common,
        headline: 'entrou na comunidade',
        source: 'Comunidades',
        communityId: dto.community?.slug,
      };
    case 'amigos':
      return {
        ...common,
        headline: `agora é amigo(a) de ${dto.friend?.name ?? ''}`.trim(),
        source: 'Amigos',
      };
    default:
      return { ...common, headline: 'atualizou o status', source: 'Status', status: dto.status };
  }
}

export function toCommunitySummary(dto: CommunitySummaryDto): Community {
  return {
    id: dto.slug,
    dbId: dto.id,
    name: dto.name,
    icon: dto.icon,
    tone: toneFor(dto.id),
    category: dto.category,
    members: compactNumber(dto.members),
    memberCount: dto.members,
    visibility: dto.visibility,
    about: '',
    createdAt: '',
    owner: '',
    isOwner: false,
    language: '',
    location: '',
    joined: dto.joined,
    friendsInside: [],
    related: [],
    topics: [],
    polls: [],
    events: [],
    loaded: false,
  };
}

export function toCommunityDetail(base: string, dto: CommunityDetailDto, meId: string): Community {
  const now = Date.now();
  return {
    ...toCommunitySummary(dto),
    about: dto.about,
    createdAt: shortDate(dto.createdAt),
    owner: dto.owner.name,
    isOwner: dto.owner.id === meId,
    language: dto.language,
    location: dto.location,
    friendsInside: dto.friendsInside.map((p) => firstNameOf(p.name)),
    related: dto.related.map((r) => r.slug),
    topics: dto.topics.map((t) => {
      const author = toPerson(base, t.author);
      const answered = t.replies > 0;
      return {
        id: t.id,
        title: t.title,
        author: author.name,
        tone: author.tone,
        activity: `${answered ? 'última resposta' : 'criado'} ${relativeTime(t.lastActivity)}`,
        replies: compactNumber(t.replies),
        pinned: t.pinned,
        isNew: now - new Date(t.createdAt).getTime() < 24 * 60 * 60 * 1000,
      };
    }),
    polls: dto.polls,
    events: dto.events.map((e) => ({
      id: e.id,
      title: e.title,
      date: eventDate(e.startsAt),
      place: e.place,
      going: e.going,
    })),
    loaded: true,
  };
}
