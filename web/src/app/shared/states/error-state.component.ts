import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ApiError } from '../../core/api/api-error';

@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="error" role="alert">
      <div class="glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            d="M12 2 1.5 20.5h21L12 2Zm0 4.9 6.9 12.1H5.1L12 6.9ZM11 10h2v5h-2v-5Zm0 6.2h2v2h-2v-2Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div class="content">
        <h3 class="title">{{ title() }}</h3>
        <p class="message">{{ message() }}</p>
        @if (requestId(); as id) {
          <p class="meta">request {{ id }}</p>
        }
      </div>
      <div class="actions">
        <button type="button" class="btn btn--primary" (click)="retry.emit()">Try again</button>
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .error {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
      padding: var(--space-9) var(--space-6);
      text-align: center;
      background: var(--color-surface);
      border: var(--border-width) solid var(--color-danger);
      border-radius: var(--radius-xl);
      animation: fade-in var(--duration-base) var(--ease-out);
    }

    .glyph {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: var(--radius-pill);
      background: var(--color-danger-soft);
      color: var(--color-danger);
    }

    .glyph svg {
      width: 26px;
      height: 26px;
    }

    .content {
      display: grid;
      gap: var(--space-2);
      justify-items: center;
    }

    .title {
      font-size: var(--text-xl);
    }

    .message {
      max-width: 52ch;
      color: var(--color-text-muted);
    }

    .meta {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-subtle);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      justify-content: center;
    }
  `,
})
export class ErrorStateComponent {
  readonly error = input<ApiError | null>(null);
  readonly fallbackTitle = input<string>('Something went wrong');
  readonly retry = output<void>();

  readonly title = computed(() => {
    const error = this.error();
    if (error === null) return this.fallbackTitle();
    if (error.kind === 'network') return 'API unreachable';
    if (error.kind === 'unauthorized') return 'Not authorised';
    if (error.kind === 'server') return 'The server failed';
    return this.fallbackTitle();
  });

  readonly message = computed(
    () => this.error()?.message ?? 'The request did not complete. Please try again.',
  );

  readonly requestId = computed(() => this.error()?.requestId ?? null);
}
