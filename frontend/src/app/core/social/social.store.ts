import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import type {
  Album,
  Community,
  Conversation,
  FeedItem,
  Friend,
  FriendRequest,
  Photo,
  Profile,
  Scrap,
  Settings,
  Suggestion,
  Testimonial,
  Tone,
  Topic,
  Visibility,
} from './social.models';
import {
  defaultSettings,
  seedAlbums,
  seedCommunities,
  seedConversations,
  seedFeed,
  seedFriendRequests,
  seedFriends,
  seedPhotos,
  seedProfile,
  seedScraps,
  seedSuggestions,
  seedTestimonials,
} from './social.seed';

const SETTINGS_KEY = 'orkut.settings';

/**
 * Estado das telas sociais em signals. Toda mutação passa por métodos deste
 * serviço, então trocar a fonte de dados por uma API HTTP não muda as telas.
 *
 * Enquanto a API social não existe, o estado nasce dos dados do design
 * (`social.seed.ts`) e só as preferências de aparência são persistidas no
 * navegador (nada sensível).
 */
@Injectable({ providedIn: 'root' })
export class SocialStore {
  private readonly auth = inject(AuthService);
  private nextId = 0;

  private readonly profileState = signal<Profile>(seedProfile());
  private readonly friendsState = signal<Friend[]>(seedFriends());
  private readonly requestsState = signal<FriendRequest[]>(seedFriendRequests());
  private readonly suggestionsState = signal<Suggestion[]>(seedSuggestions());
  private readonly scrapsState = signal<Scrap[]>(seedScraps());
  private readonly conversationsState = signal<Conversation[]>(seedConversations());
  private readonly testimonialsState = signal<Testimonial[]>(seedTestimonials());
  private readonly albumsState = signal<Album[]>(seedAlbums());
  private readonly photosState = signal<Photo[]>(seedPhotos());
  private readonly feedState = signal<FeedItem[]>(seedFeed());
  private readonly communitiesState = signal<Community[]>(seedCommunities());
  private readonly settingsState = signal<Settings>(loadSettings());

  readonly profile = this.profileState.asReadonly();
  readonly friends = this.friendsState.asReadonly();
  readonly friendRequests = this.requestsState.asReadonly();
  readonly suggestions = this.suggestionsState.asReadonly();
  readonly scraps = this.scrapsState.asReadonly();
  readonly conversations = this.conversationsState.asReadonly();
  readonly testimonials = this.testimonialsState.asReadonly();
  readonly albums = this.albumsState.asReadonly();
  readonly photos = this.photosState.asReadonly();
  readonly feed = this.feedState.asReadonly();
  readonly communities = this.communitiesState.asReadonly();
  readonly settings = this.settingsState.asReadonly();

  /** Vira true quando o usuário edita o nome em "Editar perfil". */
  private readonly nameEdited = signal(false);

  /** Nome exibido: o da sessão, até o usuário editá-lo no perfil. */
  readonly displayName = computed(() => {
    const profile = this.profileState();
    const fromProfile = `${profile.firstName} ${profile.lastName}`.trim();
    if (this.nameEdited()) return fromProfile;
    return this.auth.user()?.displayName ?? fromProfile;
  });
  readonly firstName = computed(() => this.displayName().split(' ')[0] ?? '');

  readonly receivedScraps = computed(() =>
    this.scrapsState().filter((scrap) => scrap.direction === 'recebido'),
  );
  readonly unreadScraps = computed(() => this.receivedScraps().filter((s) => !s.read).length);
  readonly unreadMessages = computed(() =>
    this.conversationsState().reduce((total, c) => total + c.unread, 0),
  );
  readonly totalPhotos = computed(() =>
    this.albumsState().reduce((total, album) => total + album.photos, 0),
  );
  readonly onlineFriends = computed(() => this.friendsState().filter((f) => f.online));
  readonly myCommunities = computed(() => this.communitiesState().filter((c) => c.joined));
  readonly pendingTestimonials = computed(() =>
    this.testimonialsState().filter((t) => t.status === 'pendente'),
  );

  // ── Perfil ────────────────────────────────────────────────────────────────

  updateProfile(changes: Partial<Profile>): void {
    if (changes.firstName !== undefined || changes.lastName !== undefined) {
      this.nameEdited.set(true);
    }
    this.profileState.update((profile) => ({ ...profile, ...changes }));
  }

  // ── Amigos ────────────────────────────────────────────────────────────────

  friendById(id: string): Friend | undefined {
    return this.friendsState().find((friend) => friend.id === id);
  }

  acceptFriendRequest(id: string): void {
    const request = this.requestsState().find((r) => r.id === id);
    if (!request) return;

    this.requestsState.update((list) => list.filter((r) => r.id !== id));
    this.friendsState.update((list) => [
      {
        id: request.id,
        name: request.name,
        shortName: request.name.split(' ')[0] ?? request.name,
        initials: request.initials,
        tone: request.tone,
        online: false,
        bestFriend: false,
        mutualFriends: request.mutualFriends,
      },
      ...list,
    ]);
  }

  rejectFriendRequest(id: string): void {
    this.requestsState.update((list) => list.filter((r) => r.id !== id));
  }

  toggleSuggestionRequest(id: string): void {
    this.suggestionsState.update((list) =>
      list.map((s) => (s.id === id ? { ...s, requested: !s.requested } : s)),
    );
  }

  // ── Recados ───────────────────────────────────────────────────────────────

  sendScrap(text: string, to?: Friend): void {
    const clean = text.trim();
    if (!clean) return;

    this.scrapsState.update((list) => [
      {
        id: this.newId('scrap'),
        authorId: 'me',
        authorName: 'Você',
        toName: to?.name ?? this.displayName(),
        tone: to?.tone ?? 'blue',
        text: clean,
        createdAt: 'agora',
        read: true,
        liked: false,
        likes: 0,
        direction: 'enviado',
        replies: [],
      },
      ...list,
    ]);
  }

  replyToScrap(id: string, text: string): void {
    const clean = text.trim();
    if (!clean) return;
    this.updateScrap(id, (scrap) => ({ ...scrap, read: true, replies: [...scrap.replies, clean] }));
  }

  toggleScrapLike(id: string): void {
    this.updateScrap(id, (scrap) => ({
      ...scrap,
      liked: !scrap.liked,
      likes: scrap.likes + (scrap.liked ? -1 : 1),
    }));
  }

  markScrapRead(id: string): void {
    this.updateScrap(id, (scrap) => ({ ...scrap, read: true }));
  }

  deleteScrap(id: string): void {
    this.scrapsState.update((list) => list.filter((scrap) => scrap.id !== id));
  }

  // ── Mensagens ─────────────────────────────────────────────────────────────

  conversationById(id: string): Conversation | undefined {
    return this.conversationsState().find((c) => c.id === id);
  }

  openConversation(id: string): void {
    this.updateConversation(id, (c) => ({ ...c, unread: 0 }));
  }

  sendMessage(conversationId: string, text: string): void {
    const clean = text.trim();
    if (!clean) return;

    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    this.updateConversation(conversationId, (c) => ({
      ...c,
      lastActivity: 'agora',
      typing: false,
      messages: [...c.messages, { id: this.newId('msg'), fromMe: true, text: clean, time }],
    }));
  }

  /** Inicia (ou reabre) uma conversa com um amigo e devolve o id dela. */
  startConversation(friend: Friend): string {
    if (!this.conversationById(friend.id)) {
      this.conversationsState.update((list) => [
        {
          id: friend.id,
          friendId: friend.id,
          name: friend.name,
          tone: friend.tone,
          online: friend.online,
          typing: false,
          unread: 0,
          lastActivity: 'agora',
          messages: [],
        },
        ...list,
      ]);
    }
    return friend.id;
  }

  // ── Depoimentos ───────────────────────────────────────────────────────────

  approveTestimonial(id: string): void {
    this.updateTestimonial(id, (t) => ({ ...t, status: 'recebido' }));
  }

  rejectTestimonial(id: string): void {
    this.testimonialsState.update((list) => list.filter((t) => t.id !== id));
  }

  toggleTestimonialLike(id: string): void {
    this.updateTestimonial(id, (t) => ({
      ...t,
      liked: !t.liked,
      likes: t.likes + (t.liked ? -1 : 1),
    }));
  }

  writeTestimonial(friend: Friend, text: string): void {
    const clean = text.trim();
    if (!clean) return;

    this.testimonialsState.update((list) => [
      {
        id: this.newId('testimonial'),
        authorName: 'Você',
        toName: friend.name,
        tone: friend.tone,
        text: clean,
        date: 'hoje',
        likes: 0,
        liked: false,
        status: 'enviado',
      },
      ...list,
    ]);
  }

  // ── Álbum ─────────────────────────────────────────────────────────────────

  createAlbum(title: string, visibility: Visibility = 'somente-eu'): void {
    const clean = title.trim();
    if (!clean) return;

    const tones: Tone[] = ['pink', 'lavender', 'teal', 'yellow'];
    this.albumsState.update((list) => [
      ...list,
      {
        id: this.newId('album'),
        title: clean,
        tone: tones[list.length % tones.length] ?? 'pink',
        photos: 0,
        visibility,
      },
    ]);
  }

  /** Fotos escolhidas pelo usuário ficam só nesta sessão (object URLs locais). */
  addPhotos(files: readonly File[]): number {
    const images = files.filter((file) => /^image\/(png|jpeg)$/.test(file.type));
    const accepted = images.filter((file) => file.size <= 5 * 1024 * 1024);
    if (!accepted.length) return 0;

    this.photosState.update((list) => [
      ...accepted.map((file) => ({
        id: this.newId('photo'),
        tone: 'gray' as Tone,
        url: URL.createObjectURL(file),
        alt: file.name,
      })),
      ...list,
    ]);
    return accepted.length;
  }

  // ── Feeds ─────────────────────────────────────────────────────────────────

  toggleFeedLike(id: string): void {
    this.feedState.update((list) =>
      list.map((item) =>
        item.id === id
          ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) }
          : item,
      ),
    );
  }

  // ── Comunidades ───────────────────────────────────────────────────────────

  communityById(id: string): Community | undefined {
    return this.communitiesState().find((c) => c.id === id);
  }

  toggleMembership(id: string): void {
    this.updateCommunity(id, (c) => ({ ...c, joined: !c.joined }));
  }

  createTopic(communityId: string, title: string): void {
    const clean = title.trim();
    if (!clean) return;

    const topic: Topic = {
      id: this.newId('topic'),
      title: clean,
      author: this.displayName(),
      tone: 'blue',
      activity: 'criado agora',
      replies: '0',
      isNew: true,
    };
    this.updateCommunity(communityId, (c) => {
      const pinned = c.topics.filter((t) => t.pinned);
      const rest = c.topics.filter((t) => !t.pinned);
      return { ...c, topics: [...pinned, topic, ...rest] };
    });
  }

  vote(communityId: string, pollId: string, optionIndex: number): void {
    this.updateCommunity(communityId, (c) => ({
      ...c,
      polls: c.polls.map((poll) =>
        poll.id !== pollId || poll.votedIndex !== null
          ? poll
          : {
              ...poll,
              votedIndex: optionIndex,
              options: poll.options.map((option, index) =>
                index === optionIndex ? { ...option, votes: option.votes + 1 } : option,
              ),
            },
      ),
    }));
  }

  toggleEventAttendance(communityId: string, eventId: string): void {
    this.updateCommunity(communityId, (c) => ({
      ...c,
      events: c.events.map((e) => (e.id === eventId ? { ...e, going: !e.going } : e)),
    }));
  }

  // ── Configurações ─────────────────────────────────────────────────────────

  /** Só grava no navegador quando o usuário muda algo (nada é salvo por padrão). */
  updateSettings(changes: Partial<Settings>): void {
    this.settingsState.update((settings) => ({ ...settings, ...changes }));
    saveSettings(this.settingsState());
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  private newId(prefix: string): string {
    this.nextId += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.nextId}`;
  }

  private updateScrap(id: string, change: (scrap: Scrap) => Scrap): void {
    this.scrapsState.update((list) => list.map((s) => (s.id === id ? change(s) : s)));
  }

  private updateConversation(id: string, change: (c: Conversation) => Conversation): void {
    this.conversationsState.update((list) => list.map((c) => (c.id === id ? change(c) : c)));
  }

  private updateTestimonial(id: string, change: (t: Testimonial) => Testimonial): void {
    this.testimonialsState.update((list) => list.map((t) => (t.id === id ? change(t) : t)));
  }

  private updateCommunity(id: string, change: (c: Community) => Community): void {
    this.communitiesState.update((list) => list.map((c) => (c.id === id ? change(c) : c)));
  }
}

/** Preferências não sensíveis (tema, privacidade) sobrevivem ao recarregar. */
function loadSettings(): Settings {
  const defaults = defaultSettings();
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...defaults,
      ...parsed,
      notifications: { ...defaults.notifications, ...parsed.notifications },
    };
  } catch {
    return defaults;
  }
}

function saveSettings(settings: Settings): void {
  try {
    globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Armazenamento indisponível (modo privado/bloqueado): segue só em memória.
  }
}
