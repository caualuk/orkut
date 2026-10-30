import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { toApiError } from '../http/api-error';
import { API_BASE_URL } from '../http/api.config';
import { prepareImageUpload } from './image-upload';
import {
  toAlbum,
  toCommunityDetail,
  toCommunitySummary,
  toConversation,
  toFeedItem,
  toFriend,
  toFriendRequest,
  toPhoto,
  toProfile,
  toScrap,
  toSuggestion,
  toTestimonial,
  type CommunityDetailDto,
  type CommunitySummaryDto,
  type SocialStateDto,
  type SuggestionDto,
} from './social.api';
import { firstNameOf } from './social.format';
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
  Visibility,
} from './social.models';

/** Intervalo da sincronização em segundo plano (novos recados, mensagens…). */
const SYNC_INTERVAL_MS = 20_000;

const DEFAULT_SETTINGS: Settings = {
  scrapVisibility: 'amigos',
  showRecentVisitors: true,
  allowTestimonials: true,
  appearOnline: true,
  theme: 'claro',
  language: 'pt-BR',
  notifications: { scraps: true, testimonials: true, friendRequests: true, birthdays: true },
};

const EMPTY_PROFILE: Profile = {
  id: '',
  firstName: '',
  lastName: '',
  gender: 'nao-informar',
  relationship: 'nao-informar',
  birthday: '',
  city: '',
  country: '',
  about: '',
  interests: [],
  social: { humor: '', style: '', pets: '', smoking: '', drinking: '' },
  contact: { phone: '', website: '' },
  professional: { education: '', company: '', role: '' },
  photoUrl: null,
  music: null,
  fans: 0,
  visits: { since: '', total: 0, lastWeek: 0, yesterday: 0 },
  recentVisitors: [],
};

/**
 * Estado das telas sociais em signals, sincronizado com `/api/social`.
 *
 * Tudo vem do banco (pessoas reais, nada fictício). As ações atualizam a tela
 * na hora (otimista), enviam o POST e recarregam o estado; se a API recusar,
 * o estado volta ao do servidor e `lastError` recebe a mensagem.
 */
@Injectable({ providedIn: 'root' })
export class SocialStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = `${inject(API_BASE_URL)}/social`;

  private readonly profileState = signal<Profile>(EMPTY_PROFILE);
  private readonly friendsState = signal<Friend[]>([]);
  private readonly requestsState = signal<FriendRequest[]>([]);
  private readonly suggestionsState = signal<Suggestion[]>([]);
  private readonly scrapsState = signal<Scrap[]>([]);
  private readonly conversationsState = signal<Conversation[]>([]);
  private readonly testimonialsState = signal<Testimonial[]>([]);
  private readonly albumsState = signal<Album[]>([]);
  private readonly photosState = signal<Photo[]>([]);
  private readonly feedState = signal<FeedItem[]>([]);
  private readonly communitiesState = signal<Community[]>([]);
  private readonly settingsState = signal<Settings>(DEFAULT_SETTINGS);
  private readonly loadedState = signal(false);
  private readonly errorState = signal<string | null>(null);

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
  /** O primeiro GET /state terminou (antes disso as telas mostram carregando). */
  readonly loaded = this.loadedState.asReadonly();
  /** Última falha de uma ação (mensagem segura para exibir). */
  readonly lastError = this.errorState.asReadonly();

  readonly displayName = computed(() => {
    const profile = this.profileState();
    const fromProfile = `${profile.firstName} ${profile.lastName}`.trim();
    return fromProfile || this.auth.user()?.displayName || '';
  });
  readonly firstName = computed(() => firstNameOf(this.displayName()));

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

  private photoVersion = Date.now();
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private loading: Promise<void> | null = null;
  private reloadQueued = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopSync());
  }

  // ── Sincronização ─────────────────────────────────────────────────────────

  /**
   * Carrega o estado. Se já houver um GET em andamento (que pode ter saído antes
   * da última ação), agenda mais um logo em seguida para não aplicar dado velho.
   */
  load(): Promise<void> {
    if (this.loading) {
      this.reloadQueued = true;
      return this.loading;
    }
    this.loading = firstValueFrom(this.http.get<SocialStateDto>(`${this.base}/state`))
      .then((state) => this.apply(state))
      .catch((error: unknown) => {
        this.errorState.set(toApiError(error).message);
      })
      .finally(() => {
        this.loading = null;
        this.loadedState.set(true);
        if (this.reloadQueued) {
          this.reloadQueued = false;
          void this.load();
        }
      });
    return this.loading;
  }

  /** Recarrega periodicamente enquanto a aba está visível. */
  startSync(): void {
    if (this.syncTimer) return;
    void this.load();
    this.syncTimer = setInterval(() => {
      if (globalThis.document?.visibilityState !== 'hidden') void this.load();
    }, SYNC_INTERVAL_MS);
  }

  stopSync(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = null;
  }

  clearError(): void {
    this.errorState.set(null);
  }

  /** Sai da conta: para a sincronização e descarta os dados do usuário anterior. */
  reset(): void {
    this.stopSync();
    this.profileState.set(EMPTY_PROFILE);
    this.settingsState.set(DEFAULT_SETTINGS);
    for (const list of [
      this.friendsState,
      this.requestsState,
      this.suggestionsState,
      this.scrapsState,
      this.conversationsState,
      this.testimonialsState,
      this.albumsState,
      this.photosState,
      this.feedState,
      this.communitiesState,
    ] as const) {
      (list as { set(value: never[]): void }).set([]);
    }
    this.loadedState.set(false);
  }

  // ── Perfil ────────────────────────────────────────────────────────────────

  updateProfile(changes: Partial<Profile>): void {
    this.profileState.update((profile) => ({ ...profile, ...changes }));
    const body: Record<string, unknown> = {};
    for (const key of [
      'firstName',
      'lastName',
      'gender',
      'relationship',
      'city',
      'country',
      'about',
      'interests',
      'social',
      'contact',
      'professional',
    ] as const) {
      if (changes[key] !== undefined) body[key] = changes[key];
    }
    if (changes.birthday !== undefined) body['birthday'] = changes.birthday || null;
    if (changes.music !== undefined) {
      body['personal'] = {
        musicId: changes.music?.videoId ?? '',
        musicTitle: changes.music?.title ?? '',
      };
    }
    void this.send('/profile', body);
  }

  /** Envia a foto de perfil (JPG/PNG até 5 MB; o servidor confere o conteúdo). */
  async uploadProfilePhoto(file: File): Promise<boolean> {
    const upload = await prepareImageUpload(file);
    const ok = await this.send('/profile/photo', upload, upload.type);
    if (ok) this.photoVersion = Date.now();
    await this.load();
    return ok;
  }

  async removeProfilePhoto(): Promise<void> {
    this.profileState.update((profile) => ({ ...profile, photoUrl: null }));
    await this.send('/profile/photo/remove');
  }

  // ── Amigos ────────────────────────────────────────────────────────────────

  friendById(id: string): Friend | undefined {
    return this.friendsState().find((friend) => friend.id === id);
  }

  /** Busca qualquer membro real pelo nome (para adicionar como amigo). */
  async searchPeople(query: string): Promise<Suggestion[]> {
    const q = query.trim();
    if (!q) return [];
    try {
      const { people } = await firstValueFrom(
        this.http.post<{ people: SuggestionDto[] }>(`${this.base}/people/search`, { q }),
      );
      return people.map((p) => toSuggestion(this.base, p));
    } catch (error) {
      this.errorState.set(toApiError(error).message);
      return [];
    }
  }

  requestFriend(id: string): void {
    this.suggestionsState.update((list) =>
      list.map((s) => (s.id === id ? { ...s, requested: true } : s)),
    );
    void this.send('/friends/request', { userId: id });
  }

  cancelFriendRequest(id: string): void {
    this.suggestionsState.update((list) =>
      list.map((s) => (s.id === id ? { ...s, requested: false } : s)),
    );
    void this.send('/friends/cancel', { userId: id });
  }

  acceptFriendRequest(id: string): void {
    const request = this.requestsState().find((r) => r.id === id);
    if (!request) return;
    this.requestsState.update((list) => list.filter((r) => r.id !== id));
    this.friendsState.update((list) => [
      { ...request, bestFriend: false, birthdayToday: false },
      ...list,
    ]);
    void this.send('/friends/accept', { userId: id });
  }

  rejectFriendRequest(id: string): void {
    this.requestsState.update((list) => list.filter((r) => r.id !== id));
    void this.send('/friends/reject', { userId: id });
  }

  toggleSuggestionRequest(id: string): void {
    const suggestion = this.suggestionsState().find((s) => s.id === id);
    if (!suggestion) return;
    this.suggestionsState.update((list) =>
      list.map((s) => (s.id === id ? { ...s, requested: !s.requested } : s)),
    );
    void this.send(suggestion.requested ? '/friends/cancel' : '/friends/request', { userId: id });
  }

  toggleBestFriend(id: string): void {
    const friend = this.friendById(id);
    if (!friend) return;
    this.friendsState.update((list) =>
      list.map((f) => (f.id === id ? { ...f, bestFriend: !f.bestFriend } : f)),
    );
    void this.send('/friends/best', { userId: id, best: !friend.bestFriend });
  }

  removeFriend(id: string): void {
    this.friendsState.update((list) => list.filter((f) => f.id !== id));
    void this.send('/friends/remove', { userId: id });
  }

  // ── Recados ───────────────────────────────────────────────────────────────

  /** Sem `to`, o recado vai para o próprio perfil. */
  sendScrap(text: string, to?: Friend): void {
    const clean = text.trim();
    const me = this.profileState();
    if (!clean || !me.id) return;

    this.scrapsState.update((list) => [
      {
        id: `pendente-${Date.now()}`,
        authorId: me.id,
        authorName: this.displayName(),
        tone: to?.tone ?? 'blue',
        photoUrl: me.photoUrl,
        toName: to?.name ?? this.displayName(),
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
    void this.send('/scraps', { to: to?.id ?? me.id, text: clean });
  }

  replyToScrap(id: string, text: string): void {
    const clean = text.trim();
    if (!clean) return;
    this.updateScrap(id, (scrap) => ({ ...scrap, read: true, replies: [...scrap.replies, clean] }));
    void this.send(`/scraps/${id}/reply`, { text: clean });
  }

  toggleScrapLike(id: string): void {
    this.updateScrap(id, (scrap) => ({
      ...scrap,
      liked: !scrap.liked,
      likes: scrap.likes + (scrap.liked ? -1 : 1),
    }));
    void this.send(`/scraps/${id}/like`, undefined, undefined, false);
  }

  markScrapRead(id: string): void {
    this.updateScrap(id, (scrap) => ({ ...scrap, read: true }));
    void this.send(`/scraps/${id}/read`, undefined, undefined, false);
  }

  deleteScrap(id: string): void {
    this.scrapsState.update((list) => list.filter((scrap) => scrap.id !== id));
    void this.send(`/scraps/${id}/delete`);
  }

  // ── Mensagens ─────────────────────────────────────────────────────────────

  conversationById(id: string): Conversation | undefined {
    return this.conversationsState().find((c) => c.id === id);
  }

  openConversation(id: string): void {
    const conversation = this.conversationById(id);
    if (!conversation?.unread) return;
    this.updateConversation(id, (c) => ({ ...c, unread: 0 }));
    void this.send(`/conversations/${id}/read`, undefined, undefined, false);
  }

  sendMessage(conversationId: string, text: string): void {
    const clean = text.trim();
    if (!clean) return;

    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    this.updateConversation(conversationId, (c) => ({
      ...c,
      lastActivity: time,
      messages: [...c.messages, { id: `pendente-${Date.now()}`, fromMe: true, text: clean, time }],
    }));
    void this.send(`/conversations/${conversationId}/messages`, { text: clean });
  }

  /** Abre (ou cria, só na tela) a conversa com um amigo e devolve o id dela. */
  startConversation(friend: Friend): string {
    if (!this.conversationById(friend.id)) {
      this.conversationsState.update((list) => [
        {
          id: friend.id,
          friendId: friend.id,
          name: friend.name,
          tone: friend.tone,
          photoUrl: friend.photoUrl,
          online: friend.online,
          typing: false,
          unread: 0,
          lastActivity: '',
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
    void this.send(`/testimonials/${id}/approve`);
  }

  rejectTestimonial(id: string): void {
    this.testimonialsState.update((list) => list.filter((t) => t.id !== id));
    void this.send(`/testimonials/${id}/delete`);
  }

  toggleTestimonialLike(id: string): void {
    this.updateTestimonial(id, (t) => ({
      ...t,
      liked: !t.liked,
      likes: t.likes + (t.liked ? -1 : 1),
    }));
    void this.send(`/testimonials/${id}/like`, undefined, undefined, false);
  }

  writeTestimonial(friend: Friend, text: string): void {
    const clean = text.trim();
    if (!clean) return;

    this.testimonialsState.update((list) => [
      {
        id: `pendente-${Date.now()}`,
        authorName: this.displayName(),
        tone: friend.tone,
        photoUrl: friend.photoUrl,
        toName: friend.name,
        text: clean,
        date: 'hoje',
        likes: 0,
        liked: false,
        status: 'enviado',
      },
      ...list,
    ]);
    void this.send('/testimonials', { to: friend.id, text: clean });
  }

  // ── Álbum ─────────────────────────────────────────────────────────────────

  async createAlbum(title: string, visibility: Visibility = 'somente-eu'): Promise<string | null> {
    const clean = title.trim();
    if (!clean) return null;
    try {
      const { id } = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.base}/albums`, { title: clean, visibility }),
      );
      await this.load();
      return id;
    } catch (error) {
      this.errorState.set(toApiError(error).message);
      return null;
    }
  }

  /**
   * Envia fotos (JPG/PNG até 5 MB) para um álbum; sem álbum, usa o primeiro ou
   * cria "Minhas fotos". Devolve quantas foram aceitas.
   */
  async addPhotos(files: readonly File[], albumId?: string): Promise<number> {
    const accepted = files.filter(
      (file) => /^image\/(png|jpeg)$/.test(file.type) && file.size <= 5 * 1024 * 1024,
    );
    if (!accepted.length) return 0;

    const target =
      albumId ?? this.albumsState()[0]?.id ?? (await this.createAlbum('Minhas fotos', 'amigos'));
    if (!target) return 0;

    let sent = 0;
    for (const file of accepted) {
      const upload = await prepareImageUpload(file);
      if (await this.send(`/albums/${target}/photos`, upload, upload.type, false)) sent += 1;
    }
    await this.load();
    return sent;
  }

  // ── Status e feed ─────────────────────────────────────────────────────────

  postStatus(text: string): void {
    const clean = text.trim();
    if (!clean) return;
    void this.send('/status', { text: clean });
  }

  toggleFeedLike(id: string): void {
    this.feedState.update((list) =>
      list.map((item) =>
        item.id === id
          ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) }
          : item,
      ),
    );
    void this.send('/feed/like', { item: id }, undefined, false);
  }

  commentOnFeed(id: string, text: string): void {
    const clean = text.trim();
    const me = this.profileState();
    if (!clean) return;
    this.feedState.update((list) =>
      list.map((item) =>
        item.id === id
          ? {
              ...item,
              comments: item.comments + 1,
              commentList: [
                ...item.commentList,
                {
                  id: `pendente-${Date.now()}`,
                  authorName: this.displayName(),
                  tone: 'blue',
                  photoUrl: me.photoUrl,
                  text: clean,
                  time: 'agora',
                  fresh: true,
                },
              ],
            }
          : item,
      ),
    );
    void this.send('/feed/comment', { item: id, text: clean });
  }

  // ── Comunidades ───────────────────────────────────────────────────────────

  communityById(id: string): Community | undefined {
    return this.communitiesState().find((c) => c.id === id);
  }

  /** Busca os detalhes (tópicos, enquetes, eventos) da comunidade pelo slug. */
  async loadCommunity(slug: string): Promise<Community | null> {
    try {
      const dto = await firstValueFrom(
        this.http.get<CommunityDetailDto>(`${this.base}/communities/${encodeURIComponent(slug)}`),
      );
      const detail = toCommunityDetail(this.base, dto, this.profileState().id, this.photoVersion);
      this.communitiesState.update((list) =>
        list.some((c) => c.id === slug)
          ? list.map((c) => (c.id === slug ? detail : c))
          : [...list, detail],
      );
      return detail;
    } catch {
      return null;
    }
  }

  async searchCommunities(query: string): Promise<Community[]> {
    try {
      const { communities } = await firstValueFrom(
        this.http.post<{ communities: CommunitySummaryDto[] }>(`${this.base}/communities/search`, {
          q: query.trim(),
        }),
      );
      return communities.map((c) => toCommunitySummary(this.base, c, this.photoVersion));
    } catch (error) {
      this.errorState.set(toApiError(error).message);
      return [];
    }
  }

  async createCommunity(data: {
    name: string;
    category: string;
    about: string;
    icon: string;
  }): Promise<string | null> {
    try {
      const { slug } = await firstValueFrom(
        this.http.post<{ slug: string }>(`${this.base}/communities`, data),
      );
      await this.load();
      return slug;
    } catch (error) {
      this.errorState.set(toApiError(error).message);
      return null;
    }
  }

  /** Envia a foto da comunidade (só o dono; JPG/PNG, reduzida se for grande). */
  async uploadCommunityPhoto(slug: string, file: File): Promise<boolean> {
    const community = this.communityById(slug);
    if (!community) return false;
    const upload = await prepareImageUpload(file);
    const ok = await this.send(`/communities/${community.dbId}/photo`, upload, upload.type, false);
    if (ok) this.photoVersion = Date.now();
    await this.loadCommunity(slug);
    await this.load();
    return ok;
  }

  async removeCommunityPhoto(slug: string): Promise<void> {
    const community = this.communityById(slug);
    if (!community) return;
    await this.send(`/communities/${community.dbId}/photo/remove`, undefined, undefined, false);
    await this.loadCommunity(slug);
    await this.load();
  }

  toggleMembership(id: string): void {
    const community = this.communityById(id);
    if (!community) return;
    this.updateCommunity(id, (c) => ({
      ...c,
      joined: !c.joined,
      memberCount: c.memberCount + (c.joined ? -1 : 1),
    }));
    void this.send(`/communities/${community.dbId}/${community.joined ? 'leave' : 'join'}`).then(
      () => this.loadCommunity(id),
    );
  }

  createTopic(communityId: string, title: string): void {
    const community = this.communityById(communityId);
    const clean = title.trim();
    if (!community || !clean) return;
    void this.send(`/communities/${community.dbId}/topics`, { title: clean }).then(() =>
      this.loadCommunity(communityId),
    );
  }

  createPoll(communityId: string, question: string, options: string[]): void {
    const community = this.communityById(communityId);
    if (!community) return;
    void this.send(`/communities/${community.dbId}/polls`, { question, options }).then(() =>
      this.loadCommunity(communityId),
    );
  }

  createEvent(communityId: string, data: { title: string; startsAt: string; place: string }): void {
    const community = this.communityById(communityId);
    if (!community) return;
    void this.send(`/communities/${community.dbId}/events`, data).then(() =>
      this.loadCommunity(communityId),
    );
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
    void this.send(`/polls/${pollId}/vote`, { optionIndex }, undefined, false);
  }

  toggleEventAttendance(communityId: string, eventId: string): void {
    this.updateCommunity(communityId, (c) => ({
      ...c,
      events: c.events.map((e) => (e.id === eventId ? { ...e, going: !e.going } : e)),
    }));
    void this.send(`/events/${eventId}/attend`, undefined, undefined, false);
  }

  // ── Configurações ─────────────────────────────────────────────────────────

  updateSettings(changes: Partial<Settings>): void {
    this.settingsState.update((settings) => ({
      ...settings,
      ...changes,
      notifications: { ...settings.notifications, ...changes.notifications },
    }));
    void this.send('/settings', changes, undefined, false);
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  /**
   * POST para a API. `reload` recarrega o estado depois (ids reais, contagens
   * atualizadas); ações pequenas (curtir, marcar lido) dispensam o recarregamento.
   */
  private async send(
    path: string,
    body?: unknown,
    contentType?: string,
    reload = true,
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}${path}`, body ?? null, {
          headers: contentType ? { 'Content-Type': contentType } : undefined,
        }),
      );
      if (reload) await this.load();
      return true;
    } catch (error) {
      this.errorState.set(toApiError(error).message);
      await this.load();
      return false;
    }
  }

  private apply(state: SocialStateDto): void {
    const base = this.base;
    this.profileState.set(toProfile(base, state.profile, this.photoVersion));
    this.settingsState.set({
      ...DEFAULT_SETTINGS,
      ...state.settings,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...state.settings.notifications },
    });
    this.friendsState.set(state.friends.map((f) => toFriend(base, f)));
    this.requestsState.set(state.friendRequests.map((r) => toFriendRequest(base, r)));
    this.suggestionsState.set(state.suggestions.map((s) => toSuggestion(base, s)));
    this.scrapsState.set(state.scraps.map((s) => toScrap(base, s)));
    this.conversationsState.update((current) => {
      const fromServer = state.conversations.map((c) => toConversation(base, c));
      // Conversas recém-abertas (ainda sem mensagens) continuam na lista.
      const drafts = current.filter(
        (c) => c.messages.length === 0 && !fromServer.some((s) => s.id === c.id),
      );
      return [...drafts, ...fromServer];
    });
    this.testimonialsState.set(state.testimonials.map((t) => toTestimonial(base, t)));
    this.albumsState.set(state.albums.map((a) => toAlbum(base, a)));
    this.photosState.set(state.photos.map((p) => toPhoto(base, p)));
    this.feedState.update((current) =>
      state.feed.map((dto) => {
        const item = toFeedItem(base, dto);
        // Mantém a marca `fresh` dos comentários que o usuário acabou de enviar.
        const previous = current.find((c) => c.id === item.id);
        const freshTexts = new Set(
          previous?.commentList.filter((c) => c.fresh).map((c) => c.text) ?? [],
        );
        return {
          ...item,
          commentList: item.commentList.map((c) =>
            freshTexts.has(c.text) ? { ...c, fresh: true } : c,
          ),
        };
      }),
    );
    this.communitiesState.update((current) =>
      state.communities.map((dto) => {
        const summary = toCommunitySummary(base, dto, this.photoVersion);
        const detail = current.find((c) => c.id === summary.id && c.loaded);
        return detail
          ? {
              ...detail,
              joined: summary.joined,
              members: summary.members,
              photoUrl: summary.photoUrl,
            }
          : summary;
      }),
    );
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
