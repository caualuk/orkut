import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SocialStore } from './social.store';

describe('SocialStore', () => {
  let store: SocialStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(SocialStore);
  });

  it('deriva contadores dos dados (recados não lidos, mensagens, fotos)', () => {
    expect(store.unreadScraps()).toBe(2);
    expect(store.unreadMessages()).toBe(2);
    expect(store.totalPhotos()).toBe(40);
  });

  it('envia recado (ignora texto vazio) e o lista como enviado', () => {
    store.sendScrap('   ');
    const before = store.scraps().length;

    const nina = store.friendById('nina');
    store.sendScrap('  Oi, Nina!  ', nina);

    expect(store.scraps()).toHaveLength(before + 1);
    expect(store.scraps()[0]).toMatchObject({
      text: 'Oi, Nina!',
      direction: 'enviado',
      toName: 'Nina Costa',
    });
  });

  it('curtir alterna o estado e o contador', () => {
    const [first] = store.receivedScraps();
    store.toggleScrapLike(first!.id);
    expect(store.scraps().find((s) => s.id === first!.id)).toMatchObject({ liked: true, likes: 4 });
    store.toggleScrapLike(first!.id);
    expect(store.scraps().find((s) => s.id === first!.id)).toMatchObject({
      liked: false,
      likes: 3,
    });
  });

  it('responder marca o recado como lido', () => {
    const unread = store.receivedScraps().find((s) => !s.read)!;
    store.replyToScrap(unread.id, 'Bora!');
    expect(store.scraps().find((s) => s.id === unread.id)).toMatchObject({
      read: true,
      replies: ['Bora!'],
    });
  });

  it('aceitar pedido de amizade adiciona o amigo e remove o pedido', () => {
    const friends = store.friends().length;
    store.acceptFriendRequest('req-lucas-braga');
    expect(store.friendRequests()).toHaveLength(0);
    expect(store.friends()).toHaveLength(friends + 1);
    expect(store.friends()[0]?.name).toBe('Lucas Braga');
  });

  it('abrir conversa zera os não lidos e enviar mensagem a adiciona ao fim', () => {
    store.openConversation('jean');
    expect(store.conversationById('jean')?.unread).toBe(0);

    store.sendMessage('jean', 'Valeu!');
    expect(store.conversationById('jean')?.messages.at(-1)).toMatchObject({
      fromMe: true,
      text: 'Valeu!',
    });
  });

  it('aprovar depoimento pendente o move para recebidos', () => {
    store.approveTestimonial('t-pending');
    expect(store.pendingTestimonials()).toHaveLength(0);
    expect(store.testimonials().find((t) => t.id === 't-pending')?.status).toBe('recebido');
  });

  it('vota uma única vez por enquete', () => {
    const id = 'eu-odeio-acordar-cedo';
    store.vote(id, 'pl1', 0);
    store.vote(id, 'pl1', 1);
    const poll = store.communityById(id)!.polls[0]!;
    expect(poll.votedIndex).toBe(0);
    expect(poll.options.map((o) => o.votes)).toEqual([813, 1204, 2310]);
  });

  it('cria tópico abaixo dos fixos', () => {
    store.createTopic('eu-odeio-acordar-cedo', 'Novo tópico');
    const topics = store.communityById('eu-odeio-acordar-cedo')!.topics;
    expect(topics[0]?.pinned).toBe(true);
    expect(topics[1]?.title).toBe('Novo tópico');
  });

  it('aceita só fotos JPG/PNG de até 5 MB', () => {
    const ok = new File(['x'], 'praia.png', { type: 'image/png' });
    const gif = new File(['x'], 'anim.gif', { type: 'image/gif' });
    expect(store.addPhotos([ok, gif])).toBe(1);
    expect(store.photos()[0]?.alt).toBe('praia.png');
  });

  it('nome editado no perfil substitui o da sessão', () => {
    expect(store.displayName()).toBe('Paulo Higa');
    store.updateProfile({ firstName: 'Paulinho', lastName: 'Higa' });
    expect(store.displayName()).toBe('Paulinho Higa');
    expect(store.firstName()).toBe('Paulinho');
  });

  it('só grava preferências no navegador quando o usuário as altera', () => {
    expect(localStorage.getItem('orkut.settings')).toBeNull();
    store.updateSettings({ theme: 'escuro' });
    expect(JSON.parse(localStorage.getItem('orkut.settings')!).theme).toBe('escuro');
  });
});
