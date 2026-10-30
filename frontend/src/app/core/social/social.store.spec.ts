import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { SocialStateDto } from './social.api';
import { SocialStore } from './social.store';

const ME = '11111111-1111-4111-8111-111111111111';
const ANA = '22222222-2222-4222-8222-222222222222';
const now = new Date().toISOString();
const person = (id: string, name: string) => ({ id, name, online: true, hasPhoto: false });

/** Estado como a API devolve (pessoas de teste, nunca dados de exemplo da tela). */
function state(overrides: Partial<SocialStateDto> = {}): SocialStateDto {
  return {
    profile: {
      id: ME,
      email: 'eu@orkut.test',
      firstName: 'Eu',
      lastName: 'Teste',
      gender: 'nao-informar',
      relationship: 'nao-informar',
      birthday: null,
      city: '',
      country: '',
      about: '',
      interests: [],
      social: {},
      contact: {},
      professional: {},
      hasPhoto: false,
      fans: 0,
      memberSince: '2026-01-15T12:00:00.000Z',
      visits: { total: 0, lastWeek: 0, yesterday: 0 },
      recentVisitors: [],
    },
    settings: {
      scrapVisibility: 'amigos',
      showRecentVisitors: true,
      allowTestimonials: true,
      appearOnline: true,
      theme: 'claro',
      language: 'pt-BR',
      notifications: { scraps: true, testimonials: true, friendRequests: true, birthdays: true },
    },
    friends: [
      { ...person(ANA, 'Ana Teste'), bestFriend: false, mutualFriends: 0, birthdayToday: true },
    ],
    friendRequests: [],
    suggestions: [],
    scraps: [
      {
        id: 's1',
        author: person(ANA, 'Ana Teste'),
        recipient: person(ME, 'Eu Teste'),
        text: 'Oi!',
        createdAt: now,
        read: false,
        liked: false,
        likes: 0,
        direction: 'recebido',
        replies: [],
      },
    ],
    conversations: [
      { person: person(ANA, 'Ana Teste'), unread: 2, lastActivity: now, messages: [] },
    ],
    testimonials: [],
    albums: [
      {
        id: 'a1',
        title: 'Viagem',
        visibility: 'amigos',
        photos: 3,
        coverPhotoId: 'p1',
      },
    ],
    photos: [],
    feed: [],
    communities: [],
    ...overrides,
  };
}

describe('SocialStore', () => {
  let store: SocialStore;
  let http: HttpTestingController;

  const flushState = (dto: SocialStateDto = state()) =>
    http.expectOne('/api/social/state').flush(dto);

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(SocialStore);
    http = TestBed.inject(HttpTestingController);

    const loading = store.load();
    flushState();
    await loading;
  });

  afterEach(() => http.verify());

  it('mapeia o estado da API e deriva os contadores', () => {
    expect(store.loaded()).toBe(true);
    expect(store.displayName()).toBe('Eu Teste');
    expect(store.profile().visits.since).toMatch(/jan/);
    expect(store.friends()[0]).toMatchObject({ name: 'Ana Teste', initials: 'AT', online: true });
    expect(store.unreadScraps()).toBe(1);
    expect(store.unreadMessages()).toBe(2);
    expect(store.totalPhotos()).toBe(3);
    expect(store.albums()[0]?.coverUrl).toBe('/api/social/photos/p1');
  });

  it('recado: mostra na hora, envia à API e recarrega o estado', async () => {
    store.sendScrap('   ');
    http.expectNone('/api/social/scraps');

    store.sendScrap('  Oi, Ana!  ', store.friends()[0]);
    expect(store.scraps()[0]).toMatchObject({ text: 'Oi, Ana!', direction: 'enviado' });

    const post = http.expectOne('/api/social/scraps');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ to: ANA, text: 'Oi, Ana!' });
    post.flush(null, { status: 204, statusText: 'No Content' });
    await Promise.resolve();
    await Promise.resolve();
    flushState();
  });

  it('curtir é otimista e não recarrega o estado', async () => {
    store.toggleScrapLike('s1');
    expect(store.scraps()[0]).toMatchObject({ liked: true, likes: 1 });
    http.expectOne('/api/social/scraps/s1/like').flush(null, { status: 204, statusText: '' });
    await Promise.resolve();
    http.expectNone('/api/social/state');
  });

  it('se a API recusar, guarda a mensagem e volta ao estado do servidor', async () => {
    store.sendScrap('Oi', store.friends()[0]);
    http
      .expectOne('/api/social/scraps')
      .flush(
        { error: { code: 'FORBIDDEN', message: 'Ação disponível apenas entre amigos.' } },
        { status: 403, statusText: 'Forbidden' },
      );
    await Promise.resolve();
    await Promise.resolve();
    expect(store.lastError()).toBe('Ação disponível apenas entre amigos.');
    flushState();
    await Promise.resolve();
    expect(store.scraps().some((s) => s.text === 'Oi')).toBe(false);
  });

  it('comentário no feed entra marcado como novo (para animar)', () => {
    const loading = store.load();
    flushState(
      state({
        feed: [
          {
            id: `status:${ANA}`,
            kind: 'status',
            actor: person(ANA, 'Ana Teste'),
            createdAt: now,
            status: 'Partiu praia!',
            likes: 0,
            liked: false,
            comments: 0,
            commentList: [],
          },
        ],
      }),
    );
    return loading.then(async () => {
      store.commentOnFeed(`status:${ANA}`, 'Boa viagem!');
      const [item] = store.feed();
      expect(item).toMatchObject({ comments: 1 });
      expect(item?.commentList[0]).toMatchObject({ text: 'Boa viagem!', fresh: true });
      http
        .expectOne('/api/social/feed/comment')
        .flush(null, { status: 204, statusText: 'No Content' });
      await Promise.resolve();
      await Promise.resolve();
      flushState();
    });
  });

  it('reset descarta os dados ao sair da conta', () => {
    store.reset();
    expect(store.friends()).toEqual([]);
    expect(store.profile().id).toBe('');
    expect(store.loaded()).toBe(false);
  });
});
