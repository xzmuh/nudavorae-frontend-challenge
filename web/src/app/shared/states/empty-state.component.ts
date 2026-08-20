import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" role="status">
      <div class="glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            d="M10.5 3a7.5 7.5 0 1 1-4.6 13.4l-3.2 3.2-1.4-1.4 3.2-3.2A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <h3 class="title">{{ title() }}</h3>
      <p class="description">{{ description() }}</p>
      <div class="actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .empty {
      display: grid;
      justify-items: center;
      gap: var(--space-3);
      padding: var(--space-10) var(--space-6);
      text-align: center;
      background: var(--color-surface);
      border: var(--border-width) dashed var(--color-border-strong);
      border-radius: var(--radius-xl);
      animation: fade-in var(--duration-base) var(--ease-out);
    }

    .glyph {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: var(--radius-pill);
      background: var(--color-accent-soft);
      color: var(--color-accent);
    }

    .glyph svg {
      width: 26px;
      height: 26px;
    }

    .title {
      font-size: var(--text-xl);
    }

    .description {
      max-width: 46ch;
      color: var(--color-text-muted);
      font-size: var(--text-md);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      justify-content: center;
      margin-top: var(--space-2);
    }

    .actions:empty {
      display: none;
    }
  `,
})
export class EmptyStateComponent {
  readonly title = input<string>('Nothing here yet');
  readonly description = input<string>('');
}
