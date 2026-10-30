import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import type { Tone } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import { Avatar } from '../../shared/ui/avatar/avatar';

interface SearchResult {
  kind: 'Amigo' | 'Comunidade' | 'Pessoas';
  label: string;
  detail: string;
  tone: Tone;
  link: string;
  query?: Record<string, string>;
}

const MAX_RESULTS = 6;

/** Busca global da Top App Bar: amigos e comunidades, com sugestões em lista. */
@Component({
  selector: 'ok-global-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, MatAutocompleteModule, MatIconModule],
  template: `
    <form role="search" class="search" (submit)="$event.preventDefault(); submit()">
      <mat-icon
        aria-hidden="true"
        fontIcon="search"
        class="!size-[18px] !text-[18px] text-primary"
      />
      <input
        type="search"
        class="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        [placeholder]="placeholder()"
        aria-label="Pesquisar no orkut"
        maxlength="80"
        [value]="term()"
        (input)="term.set($any($event.target).value)"
        [matAutocomplete]="auto"
        data-testid="global-search"
      />
    </form>
    <mat-autocomplete #auto="matAutocomplete" (optionSelected)="open($event.option.value)">
      @for (result of results(); track result.kind + result.label) {
        <mat-option [value]="result">
          <span class="flex items-center gap-3 py-1">
            <ok-avatar [tone]="result.tone" [size]="32" />
            <span class="flex flex-col leading-tight">
              <span class="text-sm font-semibold">{{ result.label }}</span>
              <span class="text-xs text-ink-muted">{{ result.kind }} · {{ result.detail }}</span>
            </span>
          </span>
        </mat-option>
      } @empty {
        @if (term().trim()) {
          <mat-option disabled>Nada encontrado para "{{ term().trim() }}"</mat-option>
        }
      }
    </mat-autocomplete>
  `,
  styles: `
    .search {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      background: var(--color-surface-variant);
      transition: box-shadow 150ms var(--ease-emphasized);
    }

    .search:focus-within {
      box-shadow: 0 0 0 2px var(--color-primary);
    }
  `,
})
export class GlobalSearch {
  readonly placeholder = input('Pesquisar no orkut');

  private readonly store = inject(SocialStore);
  private readonly router = inject(Router);
  protected readonly term = signal('');

  protected readonly results = computed<SearchResult[]>(() => {
    const term = normalize(this.term());
    if (!term) return [];

    const friends = this.store
      .friends()
      .filter((friend) => normalize(friend.name).includes(term))
      .map<SearchResult>((friend) => ({
        kind: 'Amigo',
        label: friend.name,
        detail: `${friend.mutualFriends} amigos em comum`,
        tone: friend.tone,
        link: '/amigos',
        query: { busca: friend.name },
      }));
    const communities = this.store
      .communities()
      .filter((community) => normalize(community.name).includes(term))
      .map<SearchResult>((community) => ({
        kind: 'Comunidade',
        label: community.name,
        detail: `${community.members} membros`,
        tone: community.tone,
        link: `/comunidades/${community.id}`,
      }));

    // Sempre oferece buscar o termo entre todos os membros (para adicionar amigos).
    const everyone: SearchResult = {
      kind: 'Pessoas',
      label: `Buscar "${this.term().trim()}" no orkut`,
      detail: 'todas as pessoas',
      tone: 'gray',
      link: '/amigos',
      query: { busca: this.term().trim() },
    };
    return [...[...friends, ...communities].slice(0, MAX_RESULTS - 1), everyone];
  });

  protected submit(): void {
    const first = this.results()[0];
    if (first) this.open(first);
  }

  protected open(result: SearchResult): void {
    this.term.set('');
    void this.router.navigate([result.link], { queryParams: result.query });
  }
}

/** Busca sem acento e sem diferenciar maiúsculas. */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
