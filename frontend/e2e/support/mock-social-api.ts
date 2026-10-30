import type { Page, Route } from '@playwright/test';

/**
 * API social simulada para os testes de UI: guarda o estado em memória e
 * aplica as ações (recado, curtida, aceite…) como o backend faria, para que a
 * tela reflita o resultado depois do GET /state. Pessoas e textos são de teste.
 */

export const ME_ID = '00000000-0000-4000-8000-000000000001';
export const PEOPLE = {
  ana: { id: '00000000-0000-4000-8000-0000000000a1', name: 'Ana Teste' },
  bruno: { id: '00000000-0000-4000-8000-0000000000b2', name: 'Bruno Teste' },
  carla: { id: '00000000-0000-4000-8000-0000000000c3', name: 'Carla Teste' },
  davi: { id: '00000000-0000-4000-8000-0000000000d4', name: 'Davi Teste' },
};

type Json = Record<string, unknown>;

/** PNG 1×1 válido, para a foto de comunidade simulada. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const now = () => new Date().toISOString();
const person = (p: { id: string; name: string }, online = false) => ({
  ...p,
  online,
  hasPhoto: false,
});

export function initialSocialState() {
  const me = { id: ME_ID, name: 'Paulo Teste' };
  return {
    profile: {
      id: ME_ID,
      email: 'paulo@orkut.com',
      firstName: 'Paulo',
      lastName: 'Teste',
      gender: 'nao-informar',
      relationship: 'nao-informar',
      birthday: null,
      city: '',
      country: 'Brasil',
      about: '',
      interests: [] as string[],
      social: {},
      contact: {},
      professional: {},
      hasPhoto: false,
      fans: 0,
      memberSince: '2026-01-10T12:00:00.000Z',
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
      { ...person(PEOPLE.ana, true), bestFriend: true, mutualFriends: 1, birthdayToday: true },
      { ...person(PEOPLE.bruno), bestFriend: false, mutualFriends: 1, birthdayToday: false },
    ],
    friendRequests: [{ ...person(PEOPLE.carla), mutualFriends: 0, createdAt: now() }],
    suggestions: [{ ...person(PEOPLE.davi), mutualFriends: 1, requested: false }],
    scraps: [
      {
        id: 'scrap-1',
        author: person(PEOPLE.ana, true),
        recipient: person(me),
        text: 'Recado de teste da Ana',
        createdAt: now(),
        read: false,
        liked: false,
        likes: 0,
        direction: 'recebido',
        replies: [] as string[],
      },
      {
        id: 'scrap-2',
        author: person(PEOPLE.bruno),
        recipient: person(me),
        text: 'Recado de teste do Bruno',
        createdAt: now(),
        read: true,
        liked: false,
        likes: 1,
        direction: 'recebido',
        replies: [] as string[],
      },
    ],
    conversations: [
      {
        person: person(PEOPLE.ana, true),
        unread: 1,
        lastActivity: now(),
        messages: [
          { id: 'm1', fromMe: false, text: 'Mensagem de teste', createdAt: now(), read: false },
        ],
      },
    ],
    testimonials: [
      {
        id: 'dep-1',
        author: person(PEOPLE.bruno),
        recipient: person(me),
        text: 'Depoimento de teste pendente',
        createdAt: now(),
        likes: 0,
        liked: false,
        status: 'pendente',
      },
    ],
    albums: [] as Json[],
    photos: [] as Json[],
    feed: [
      {
        id: `status:${PEOPLE.ana.id}`,
        kind: 'status',
        actor: person(PEOPLE.ana, true),
        createdAt: now(),
        status: 'Status de teste',
        likes: 0,
        liked: false,
        comments: 0,
        commentList: [] as Json[],
      },
    ],
    communities: [] as Json[],
  };
}

export type SocialState = ReturnType<typeof initialSocialState>;

interface CommunityRecord {
  summary: Json & { id: string; slug: string; name: string; joined: boolean; members: number };
  topics: Json[];
}

export async function mockSocialApi(page: Page, state: SocialState = initialSocialState()) {
  const communities = new Map<string, CommunityRecord>();
  const requests: { method: string; path: string; body: unknown }[] = [];
  let sequence = 0;

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const noContent = (route: Route) => route.fulfill({ status: 204 });
  const me = () =>
    person({ id: ME_ID, name: `${state.profile.firstName} ${state.profile.lastName}` });
  const detail = (record: CommunityRecord) => ({
    ...record.summary,
    about: 'Comunidade criada no teste',
    createdAt: now(),
    owner: me(),
    language: 'Português (BR)',
    location: 'Brasil',
    friendsInside: [],
    related: [],
    topics: record.topics,
    polls: [],
    events: [],
  });

  await page.route('**/api/social/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/social/, '');
    const method = request.method();
    const isJson = request.headers()['content-type']?.includes('application/json');
    const body = (isJson ? request.postDataJSON() : null) as Json | null;
    requests.push({ method, path, body });
    let match: RegExpMatchArray | null;

    if (method === 'GET' && path === '/state') return json(route, state);
    if (method === 'GET' && /^\/communities\/[^/]+\/photo$/.test(path)) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG });
    }
    if (method === 'GET' && (match = path.match(/^\/communities\/([a-z0-9-]+)$/))) {
      const record = communities.get(match[1]!);
      return record
        ? json(route, detail(record))
        : json(route, { error: { code: 'NOT_FOUND', message: 'Comunidade não encontrada.' } }, 404);
    }
    if (method === 'GET') return route.fulfill({ status: 404 });

    switch (true) {
      case path === '/scraps': {
        const friend = [...state.friends].find((f) => f.id === body?.['to']);
        state.scraps.unshift({
          id: `scrap-${++sequence}`,
          author: me(),
          recipient: friend ? person(friend) : me(),
          text: String(body?.['text']),
          createdAt: now(),
          read: true,
          liked: false,
          likes: 0,
          direction: 'enviado',
          replies: [],
        });
        return noContent(route);
      }
      case !!(match = path.match(/^\/scraps\/([^/]+)\/like$/)): {
        const scrap = state.scraps.find((s) => s.id === match![1]);
        if (scrap) {
          scrap.likes += scrap.liked ? -1 : 1;
          scrap.liked = !scrap.liked;
        }
        return noContent(route);
      }
      case path === '/friends/accept': {
        const index = state.friendRequests.findIndex((r) => r.id === body?.['userId']);
        const [accepted] = state.friendRequests.splice(index, 1);
        if (accepted) {
          state.friends.push({
            id: accepted.id,
            name: accepted.name,
            online: false,
            hasPhoto: false,
            bestFriend: false,
            mutualFriends: 0,
            birthdayToday: false,
          });
        }
        return noContent(route);
      }
      case path === '/friends/request': {
        const suggestion = state.suggestions.find((s) => s.id === body?.['userId']);
        if (suggestion) suggestion.requested = true;
        return noContent(route);
      }
      case path === '/people/search': {
        const q = String(body?.['q'] ?? '').toLowerCase();
        const everyone = [PEOPLE.ana, PEOPLE.bruno, PEOPLE.carla, PEOPLE.davi];
        const people = everyone
          .filter((p) => p.name.toLowerCase().includes(q))
          .map((p) => ({
            ...person(p),
            mutualFriends: 0,
            requested: false,
            friend: state.friends.some((f) => f.id === p.id),
          }));
        return json(route, { people });
      }
      case !!(match = path.match(/^\/conversations\/([^/]+)\/messages$/)): {
        const conversation = state.conversations.find((c) => c.person.id === match![1]);
        conversation?.messages.push({
          id: `m-${++sequence}`,
          fromMe: true,
          text: String(body?.['text']),
          createdAt: now(),
          read: false,
        });
        return noContent(route);
      }
      case !!(match = path.match(/^\/conversations\/([^/]+)\/read$/)): {
        const conversation = state.conversations.find((c) => c.person.id === match![1]);
        if (conversation) conversation.unread = 0;
        return noContent(route);
      }
      case !!(match = path.match(/^\/testimonials\/([^/]+)\/approve$/)): {
        const testimonial = state.testimonials.find((t) => t.id === match![1]);
        if (testimonial) testimonial.status = 'recebido';
        return noContent(route);
      }
      case path === '/settings':
        Object.assign(state.settings, body);
        return noContent(route);
      case path === '/profile':
        Object.assign(state.profile, body);
        return noContent(route);
      case path === '/status':
        state.feed.unshift({
          id: `status:novo-${++sequence}`,
          kind: 'status',
          actor: me(),
          createdAt: now(),
          status: String(body?.['text']),
          likes: 0,
          liked: false,
          comments: 0,
          commentList: [],
        });
        return noContent(route);
      case path === '/feed/like': {
        const item = state.feed.find((f) => f.id === body?.['item']);
        if (item) {
          item.likes += item.liked ? -1 : 1;
          item.liked = !item.liked;
        }
        return noContent(route);
      }
      case path === '/feed/comment': {
        const item = state.feed.find((f) => f.id === body?.['item']);
        if (item) {
          item.comments += 1;
          item.commentList.push({
            id: `c-${++sequence}`,
            author: me(),
            text: String(body?.['text']),
            createdAt: now(),
          });
        }
        return noContent(route);
      }
      case path === '/communities': {
        const name = String(body?.['name']);
        const slug = name
          .toLowerCase()
          .normalize('NFD')
          .replace(/\p{M}/gu, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const summary = {
          id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
          slug,
          name,
          icon: String(body?.['icon'] ?? 'groups'),
          category: String(body?.['category']),
          members: 1,
          visibility: 'pública',
          joined: true,
          hasPhoto: false,
        };
        communities.set(slug, { summary, topics: [] });
        state.communities.push(summary);
        return json(route, { slug }, 201);
      }
      case !!(match = path.match(/^\/communities\/([^/]+)\/delete$/)): {
        const record = [...communities.values()].find((c) => c.summary.id === match![1]);
        if (!record) return route.fulfill({ status: 404 });
        communities.delete(record.summary.slug);
        state.communities = state.communities.filter((c) => c['id'] !== record.summary.id);
        return noContent(route);
      }
      case !!(match = path.match(/^\/communities\/([^/]+)\/photo(\/remove)?$/)): {
        const record = [...communities.values()].find((c) => c.summary.id === match![1]);
        if (!record) return route.fulfill({ status: 404 });
        record.summary['hasPhoto'] = !match![2];
        return noContent(route);
      }
      case !!(match = path.match(/^\/communities\/([^/]+)\/(join|leave|topics)$/)): {
        const record = [...communities.values()].find((c) => c.summary.id === match![1]);
        if (!record) return route.fulfill({ status: 404 });
        if (match![2] === 'topics') {
          record.topics.unshift({
            id: `t-${++sequence}`,
            title: String(body?.['title']),
            author: me(),
            pinned: false,
            replies: 0,
            createdAt: now(),
            lastActivity: now(),
          });
        } else {
          record.summary.joined = match![2] === 'join';
          record.summary.members += record.summary.joined ? 1 : -1;
        }
        return noContent(route);
      }
      default:
        return noContent(route);
    }
  });

  return { state, requests };
}
