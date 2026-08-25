import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type StatePanelTone = 'empty' | 'error';

/**
 * The designed shape of "there is nothing here" and "this did not work".
 *
 * Page 2 asks for three states "each one designed rather than a spinner and a
 * blank page", and for the empty-after-a-search screen to be a different screen
 * from an empty catalogue. This component is the shell; the two screens supply
 * the wording, which is where that difference actually lives.
 *
 * It is not a live region. Announcing belongs to the screen that swapped the
 * states, because only it knows that one replaced another rather than that this
 * one was always here.
 */
@Component({
  selector: 'nud-state-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel" [class.panel--error]="tone() === 'error'">
      <span class="panel__icon" aria-hidden="true">
        @if (tone() === 'error') {
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M12 2.8 1.6 20.4h20.8L12 2.8Zm0 5.6a1 1 0 0 1 1 1v4.4a1 1 0 1 1-2 0V9.4a1 1 0 0 1 1-1Zm0 8a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"
            />
          </svg>
        } @else {
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M10.6 2.4a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4Zm0 2a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4Zm6.9 12.1 4.1 4.1a1 1 0 0 1-1.4 1.4l-4.1-4.1a1 1 0 0 1 1.4-1.4Z"
            />
          </svg>
        }
      </span>

      <h2 class="panel__heading">{{ heading() }}</h2>
      <p class="panel__body">{{ body() }}</p>

      <div class="panel__actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .panel {
      display: grid;
      justify-items: center;
      gap: var(--space-2);
      padding: var(--space-12) var(--space-6);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sheet);
      background: var(--surface-raised);
      text-align: center;
    }

    .panel--error {
      border-color: var(--status-danger-border);
      background: var(--status-danger-surface);
    }

    .panel__icon {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      margin-block-end: var(--space-1);
      border-radius: var(--radius-pressed);
      background: var(--surface-hover);
      color: var(--text-muted);
    }

    .panel--error .panel__icon {
      color: var(--status-danger);
    }

    .panel__icon svg {
      inline-size: 22px;
      block-size: 22px;
      fill: currentColor;
    }

    .panel__heading {
      font-size: var(--text-20);
    }

    .panel__body {
      max-inline-size: 46ch;
      color: var(--text-secondary);
      font-size: var(--text-14);
    }

    .panel__actions:empty {
      display: none;
    }

    .panel__actions {
      margin-block-start: var(--space-2);
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      justify-content: center;
    }
  `,
})
export class StatePanelComponent {
  readonly tone = input<StatePanelTone>('empty');
  readonly heading = input.required<string>();
  readonly body = input.required<string>();
}
