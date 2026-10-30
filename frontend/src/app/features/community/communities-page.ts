import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import type { Community } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { injectCommunityDialogs } from './community-dialogs';

/** Comunidades: as do usuário, as mais populares para descobrir, busca e criação. */
@Component({
  selector: 'ok-communities-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, MatIconModule, NgTemplateOutlet, PageHeader, RouterLink],
  template: `
    <div class="flex flex-col gap-4 tab:gap-5">
      <ok-page-header heading="Comunidades" [subtitle]="subtitle()">
        <button
          type="button"
          class="ok-btn-primary"
          (click)="dialogs.createCommunity()"
          data-testid="create-community"
        >
          <mat-icon aria-hidden="true" fontIcon="add" class="!size-4 !text-base" />
          Criar comunidade
        </button>
      </ok-page-header>

      <form role="search" class="search" (submit)="$event.preventDefault(); search()">
        <mat-icon
          aria-hidden="true"
          fontIcon="search"
          class="!size-[18px] !text-[18px] text-ink-muted"
        />
        <input
          type="search"
          class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-muted"
          placeholder="Buscar comunidades"
          aria-label="Buscar comunidades"
          maxlength="80"
          [value]="query()"
          (input)="query.set($any($event.target).value); results.set(null)"
          data-testid="community-search"
        />
      </form>

      @if (results(); as found) {
        <section class="ok-card p-5" aria-labelledby="results-title">
          <h2 id="results-title" class="mb-3 text-lg font-bold text-ink">
            Resultados para "{{ lastQuery() }}"
          </h2>
          <ng-container *ngTemplateOutlet="list; context: { $implicit: found }" />
          @if (!found.length) {
            <p class="py-6 text-center text-sm text-ink-muted">
              Nenhuma comunidade encontrada. Que tal criar uma?
            </p>
          }
        </section>
      }

      @if (!store.loaded()) {
        <p class="ok-card p-8 text-center text-sm text-ink-muted" role="status">Carregando…</p>
      } @else {
        <section class="ok-card p-5" aria-labelledby="mine-title">
          <h2 id="mine-title" class="mb-3 text-lg font-bold text-ink">
            Minhas comunidades ({{ store.myCommunities().length }})
          </h2>
          @if (store.myCommunities().length) {
            <ng-container *ngTemplateOutlet="list; context: { $implicit: store.myCommunities() }" />
          } @else {
            <p class="py-6 text-center text-sm text-ink-muted" data-testid="no-communities">
              Você ainda não participa de nenhuma comunidade.
            </p>
          }
        </section>

        <section class="ok-card p-5" aria-labelledby="discover-title">
          <h2 id="discover-title" class="mb-3 text-lg font-bold text-ink">Descobrir</h2>
          @if (discover().length) {
            <ng-container *ngTemplateOutlet="list; context: { $implicit: discover() }" />
          } @else {
            <p class="py-6 text-center text-sm text-ink-muted">
              Ainda não há outras comunidades. Crie a primeira e chame seus amigos!
            </p>
          }
        </section>
      }
    </div>

    <ng-template #list let-communities>
      <ul class="grid gap-3 tab:grid-cols-2">
        @for (community of communities; track community.id; let i = $index) {
          <li class="ok-enter" [style.--i]="i">
            <a
              class="row"
              [routerLink]="['/comunidades', community.id]"
              data-testid="community-link"
            >
              <span class="relative shrink-0">
                <ok-avatar [tone]="community.tone" shape="tile" [size]="48" />
                <mat-icon aria-hidden="true" [fontIcon]="community.icon" class="icon" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-bold text-ink">{{ community.name }}</span>
                <span class="block text-xs text-ink-muted">
                  {{ community.category }} · {{ community.members }}
                  {{ community.memberCount === 1 ? 'membro' : 'membros' }}
                </span>
              </span>
              @if (community.joined) {
                <span class="text-xs font-bold text-primary-strong">Participando</span>
              }
            </a>
          </li>
        }
      </ul>
    </ng-template>
  `,
  styles: `
    .search {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 46px;
      padding: 0 18px;
      border-radius: 999px;
      border: 1px solid var(--color-outline);
      background: var(--color-surface);
    }

    .search:focus-within {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 4px rgb(233 30 99 / 20%);
    }

    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 18px;
      background: var(--color-surface-input);
      transition:
        background-color 150ms var(--ease-emphasized),
        transform 150ms var(--ease-emphasized);
    }

    .row:hover {
      background: var(--color-primary-container);
      transform: translateY(-1px);
    }

    .icon {
      position: absolute;
      inset: 0;
      margin: auto;
      color: #fff;
    }
  `,
})
export class CommunitiesPage {
  protected readonly store = inject(SocialStore);
  protected readonly dialogs = injectCommunityDialogs();

  protected readonly query = signal('');
  protected readonly lastQuery = signal('');
  protected readonly results = signal<Community[] | null>(null);

  protected readonly discover = computed(() => this.store.communities().filter((c) => !c.joined));
  protected readonly subtitle = computed(() => {
    const count = this.store.myCommunities().length;
    return `Você participa de ${count} ${count === 1 ? 'comunidade' : 'comunidades'}`;
  });

  protected async search(): Promise<void> {
    const q = this.query().trim();
    if (!q) return this.results.set(null);
    const found = await this.store.searchCommunities(q);
    this.lastQuery.set(q);
    this.results.set(found);
  }
}
