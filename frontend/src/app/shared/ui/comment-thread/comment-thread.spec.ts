import { TestBed } from '@angular/core/testing';
import type { FeedComment } from '../../../core/social/social.models';
import { CommentThread } from './comment-thread';

const comment = (id: string, text: string, fresh = false): FeedComment => ({
  id,
  authorName: 'Ana Teste',
  tone: 'blue',
  photoUrl: null,
  text,
  time: 'agora',
  fresh,
});

describe('CommentThread', () => {
  const setup = async (comments: FeedComment[]) => {
    const fixture = TestBed.createComponent(CommentThread);
    fixture.componentRef.setInput('key', 'status:1');
    fixture.componentRef.setInput('comments', comments);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('mostra os 3 mais recentes e expande os anteriores', async () => {
    const { fixture, host } = await setup(
      ['a', 'b', 'c', 'd', 'e'].map((t, i) => comment(String(i), t)),
    );
    expect(host.querySelectorAll('[data-testid="comment"]').length).toBe(3);
    const more = host.querySelector<HTMLButtonElement>('.more')!;
    expect(more.textContent).toContain('2 comentários anteriores');
    more.click();
    await fixture.whenStable();
    expect(host.querySelectorAll('[data-testid="comment"]').length).toBe(5);
  });

  it('marca o comentário novo para animar e envia o texto aparado', async () => {
    const { fixture, host } = await setup([comment('1', 'Oi', true)]);
    expect(host.querySelector('[data-testid="comment"]')?.classList).toContain('is-fresh');

    const sent: string[] = [];
    fixture.componentInstance.send.subscribe((text) => sent.push(text));
    const input = host.querySelector<HTMLInputElement>('[data-testid="comment-input"]')!;
    input.value = '  Boa!  ';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    host.querySelector<HTMLButtonElement>('[data-testid="comment-send"]')!.click();
    await fixture.whenStable();

    expect(sent).toEqual(['Boa!']);
    expect(input.value).toBe('');
  });
});
