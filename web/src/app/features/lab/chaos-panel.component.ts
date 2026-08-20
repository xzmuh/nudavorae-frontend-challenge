import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChaosApiService } from '../../core/api/chaos-api.service';
import type { ChaosRule, ChaosRuleInput } from '../../core/api/models';

interface Preset {
  id: string;
  label: string;
  hint: string;
  input: ChaosRuleInput;
}

const PRESETS: Preset[] = [
  {
    id: 'slow-sor',
    label: 'Delay searches starting with “sor” by 3s',
    hint: 'Type “sor” then finish “sorvete”: the slow answer must never win.',
    input: {
      label: 'slow q=sor',
      pathContains: '/api/services',
      queryMatch: { q: 'sor' },
      matchMode: 'equals',
      delayMs: 3000,
    },
  },
  {
    id: 'slow-list',
    label: 'Delay every catalog request by 2s',
    hint: 'Shows the catalog loading state.',
    input: { label: 'slow catalog', pathContains: '/api/services', delayMs: 2000 },
  },
  {
    id: 'fail-list',
    label: 'Fail the catalog list once (500)',
    hint: 'Shows the catalog error state, then recovers on retry.',
    input: { label: 'catalog 500', pathContains: '/api/services', status: 500, times: 1 },
  },
  {
    id: 'fail-detail',
    label: 'Fail service detail (500)',
    hint: 'Shows the detail error state.',
    input: { label: 'detail 500', method: 'GET', pathContains: '/api/services/svc_', status: 500 },
  },
  {
    id: 'missing-detail',
    label: 'Service detail returns 404',
    hint: 'Shows the detail empty state.',
    input: { label: 'detail 404', method: 'GET', pathContains: '/api/services/svc_', status: 404 },
  },
  {
    id: 'fail-review',
    label: 'Fail publishing a review (500)',
    hint: 'The average updates instantly and then rolls back.',
    input: { label: 'review 500', method: 'POST', pathContains: '/reviews', status: 500 },
  },
  {
    id: 'slow-images',
    label: 'Delay private images by 2s',
    hint: 'Shows the image placeholders while the signed requests load.',
    input: { label: 'slow images', pathContains: '/api/images/', delayMs: 2000 },
  },
];

/**
 * In-app control for the API's fault injection. It exists so the delay/error
 * scenarios can be reproduced without leaving the browser.
 */
@Component({
  selector: 'app-chaos-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="btn btn--outline btn--sm trigger"
      [attr.aria-expanded]="open()"
      aria-controls="chaos-panel"
      (click)="toggle()"
    >
      <span class="dot" [class.dot--on]="rules().length > 0" aria-hidden="true"></span>
      Lab
      @if (rules().length > 0) {
        <span class="count">{{ rules().length }}</span>
      }
    </button>

    @if (open()) {
      <button
        type="button"
        class="backdrop"
        aria-label="Close the lab panel"
        (click)="close()"
      ></button>
      <section id="chaos-panel" class="panel" aria-label="Fault injection lab">
        <header class="panel__head">
          <div>
            <h2 class="panel__title">Lab</h2>
            <p class="panel__subtitle">Delay or break one specific API response.</p>
          </div>
          <button type="button" class="btn btn--ghost btn--sm" (click)="close()">Close</button>
        </header>

        <div class="panel__body">
          <ul class="presets">
            @for (preset of presets; track preset.id) {
              <li>
                <button type="button" class="preset" [disabled]="busy()" (click)="apply(preset)">
                  <span class="preset__label">{{ preset.label }}</span>
                  <span class="preset__hint">{{ preset.hint }}</span>
                </button>
              </li>
            }
          </ul>

          <div class="rules">
            <div class="rules__head">
              <h3 class="rules__title">Active rules</h3>
              @if (rules().length > 0) {
                <button type="button" class="btn btn--ghost btn--sm" (click)="clear()">
                  Clear all
                </button>
              }
            </div>

            @if (rules().length === 0) {
              <p class="rules__empty">No rules. The API answers normally.</p>
            } @else {
              <ul class="rules__list">
                @for (rule of rules(); track rule.id) {
                  <li class="rule">
                    <div>
                      <p class="rule__label">{{ rule.label }}</p>
                      <p class="rule__meta">
                        {{ rule.delayMs > 0 ? rule.delayMs + 'ms delay' : '' }}
                        {{ rule.status !== null ? 'status ' + rule.status : '' }}
                        · {{ rule.hits }} hits
                        {{ rule.remaining !== null ? '· ' + rule.remaining + ' left' : '' }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="btn btn--ghost btn--sm"
                      (click)="remove(rule.id)"
                      [attr.aria-label]="'Remove rule ' + rule.label"
                    >
                      Remove
                    </button>
                  </li>
                }
              </ul>
            }
          </div>

          @if (failure(); as message) {
            <p class="failure" role="alert">{{ message }}</p>
          }
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .trigger {
      gap: var(--space-2);
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: var(--radius-pill);
      background: var(--color-border-strong);
    }

    .dot--on {
      background: var(--color-warning);
    }

    .count {
      padding-inline: var(--space-2);
      border-radius: var(--radius-pill);
      background: var(--color-warning-soft);
      color: var(--color-warning);
      font-size: var(--text-2xs);
    }

    .backdrop {
      position: fixed;
      inset: 0;
      padding: 0;
      border: none;
      cursor: default;
      z-index: var(--z-panel);
      background: var(--color-overlay);
      animation: fade-in var(--duration-fast) var(--ease-out);
    }

    .panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: var(--z-panel);
      display: flex;
      flex-direction: column;
      width: min(420px, 100vw);
      background: var(--color-surface);
      border-left: var(--border-width) solid var(--color-border);
      box-shadow: var(--shadow-lg);
      animation: slide-in var(--duration-base) var(--ease-out);
    }

    @keyframes slide-in {
      from {
        transform: translateX(24px);
        opacity: 0;
      }
    }

    .panel__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-5);
      border-bottom: var(--border-width) solid var(--color-border);
    }

    .panel__title {
      font-size: var(--text-xl);
    }

    .panel__subtitle {
      color: var(--color-text-muted);
      font-size: var(--text-sm);
    }

    .panel__body {
      display: grid;
      gap: var(--space-5);
      align-content: start;
      overflow-y: auto;
      padding: var(--space-5);
    }

    .presets {
      display: grid;
      gap: var(--space-2);
      margin: 0;
    }

    .preset {
      display: grid;
      gap: var(--space-1);
      width: 100%;
      padding: var(--space-3) var(--space-4);
      text-align: left;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-sunken);
      transition:
        border-color var(--duration-fast) var(--ease-out),
        background-color var(--duration-fast) var(--ease-out);
    }

    .preset:hover:not(:disabled) {
      border-color: var(--color-accent);
      background: var(--color-accent-soft);
    }

    .preset__label {
      font-size: var(--text-md);
      font-weight: var(--weight-semibold);
    }

    .preset__hint {
      color: var(--color-text-muted);
      font-size: var(--text-xs);
    }

    .rules__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-2);
    }

    .rules__title {
      font-size: var(--text-md);
    }

    .rules__empty {
      color: var(--color-text-subtle);
      font-size: var(--text-sm);
    }

    .rules__list {
      display: grid;
      gap: var(--space-2);
      margin: 0;
    }

    .rule {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-sm);
    }

    .rule__label {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
    }

    .rule__meta {
      color: var(--color-text-subtle);
      font-family: var(--font-mono);
      font-size: var(--text-2xs);
    }

    .failure {
      padding: var(--space-3);
      border-radius: var(--radius-sm);
      background: var(--color-danger-soft);
      color: var(--color-danger);
      font-size: var(--text-sm);
    }
  `,
})
export class ChaosPanelComponent {
  private readonly api = inject(ChaosApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly presets = PRESETS;
  readonly open = signal(false);
  readonly rules = signal<ChaosRule[]>([]);
  readonly busy = signal(false);
  readonly failure = signal<string | null>(null);

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.close();
  }

  toggle(): void {
    this.open.update((open) => !open);
    if (this.open()) this.refresh();
  }

  close(): void {
    this.open.set(false);
  }

  protected apply(preset: Preset): void {
    this.busy.set(true);
    this.api
      .create(preset.input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: () => {
        this.busy.set(false);
        this.refresh();
      },
      error: () => {
        this.busy.set(false);
        this.failure.set('Could not reach the API to register the rule.');
      },
    });
  }

  protected remove(ruleId: string): void {
    this.api
      .remove(ruleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: () => this.refresh(),
      error: () => this.failure.set('Could not remove the rule.'),
    });
  }

  protected clear(): void {
    this.api
      .clear()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: () => this.refresh(),
      error: () => this.failure.set('Could not clear the rules.'),
    });
  }

  private refresh(): void {
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (response) => {
        this.rules.set(response.items);
        this.failure.set(null);
      },
      error: () => this.failure.set('Could not read the rules from the API.'),
    });
  }
}
