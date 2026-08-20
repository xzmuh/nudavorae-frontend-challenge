import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  signal,
  viewChildren,
} from '@angular/core';

const LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

/**
 * Star picker, fully operable with the keyboard:
 *
 * - **Tab / Shift+Tab** walk star by star -- every star is its own tab stop;
 * - **Space or Enter** select the focused star (native `<button>` activation);
 * - **arrows** move and select in one go, **Home/End** jump to 1 and 5;
 * - **keys 1-5** select directly.
 *
 * Focusing a star previews it, so a keyboard user always sees which rating is
 * about to be selected before committing to it.
 */
@Component({
  selector: 'app-rating-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="group"
      role="radiogroup"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-disabled]="disabled() ? 'true' : null"
      (keydown)="onKeydown($event)"
    >
      @for (star of stars; track star) {
        <button
          #starButton
          type="button"
          class="star"
          role="radio"
          [class.star--on]="star <= displayValue()"
          [class.star--preview]="star <= previewValue()"
          [attr.aria-checked]="star === value()"
          [attr.aria-label]="star + ' star' + (star === 1 ? '' : 's') + ' — ' + labelFor(star)"
          [disabled]="disabled()"
          (click)="select(star)"
          (focus)="focused.set(star)"
          (blur)="onBlur(star)"
          (mouseenter)="hovered.set(star)"
          (mouseleave)="hovered.set(0)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 2.6l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.1l6.1-.9L12 2.6z"
            />
          </svg>
        </button>
      }
      <span class="caption" aria-hidden="true">{{ caption() }}</span>
      <span class="visually-hidden" role="status">{{ liveMessage() }}</span>
    </div>
  `,
  styles: `
    .group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1);
    }

    .star {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--color-border-strong);
      transition:
        color var(--duration-fast) var(--ease-out),
        transform var(--duration-fast) var(--ease-out),
        background-color var(--duration-fast) var(--ease-out);
    }

    .star:hover:not(:disabled) {
      background: var(--color-surface-hover);
    }

    .star:not(:disabled):active {
      transform: scale(0.92);
    }

    .star--on {
      color: var(--color-star);
    }

    /* A star being previewed by focus reads as "candidate", not as "chosen". */
    .star--preview {
      color: var(--color-star);
      opacity: 0.5;
    }

    .star--on.star--preview {
      opacity: 1;
    }

    .star:focus-visible {
      outline: var(--focus-ring-width) solid var(--color-accent);
      outline-offset: var(--focus-ring-offset);
      background: var(--color-accent-soft);
    }

    .star:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }

    .caption {
      margin-left: var(--space-2);
      min-width: 190px;
      flex: 1 1 auto;
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      color: var(--color-text-muted);
    }
  `,
})
export class RatingInputComponent {
  readonly value = model<number>(0);
  readonly disabled = input<boolean>(false);
  readonly ariaLabel = input<string>('Your rating');

  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly hovered = signal<number>(0);
  protected readonly focused = signal<number>(0);

  private readonly starButtons = viewChildren<ElementRef<HTMLButtonElement>>('starButton');

  /** Stars painted solid: the committed rating, or the hovered preview. */
  readonly displayValue = computed(() => (this.hovered() > 0 ? this.hovered() : this.value()));

  /** Stars painted faded: the star Tab is currently sitting on. */
  readonly previewValue = computed(() => (this.hovered() > 0 ? 0 : this.focused()));

  readonly caption = computed(() => {
    const focused = this.focused();
    if (focused > 0 && focused !== this.value()) {
      return `${focused}/5 · ${LABELS[focused] ?? ''} — Space to select`;
    }
    const current = this.displayValue();
    return current === 0 ? 'Not rated' : `${current}/5 · ${LABELS[current] ?? ''}`;
  });

  readonly liveMessage = computed(() => {
    const current = this.value();
    return current === 0 ? '' : `${current} of 5 stars selected`;
  });

  protected labelFor(star: number): string {
    return LABELS[star] ?? '';
  }

  protected select(star: number): void {
    if (this.disabled()) return;
    this.value.set(star);
  }

  protected onBlur(star: number): void {
    // Only clear the preview if focus really left this star: tabbing to the
    // next one sets `focused` again right after this blur.
    if (this.focused() === star) this.focused.set(0);
  }

  /**
   * Space and Enter are left to the browser: they activate the focused
   * `<button>` natively, which runs `select()`. Only movement keys are handled
   * here, and they select as they move.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;

    const active = this.focused() > 0 ? this.focused() : Math.max(1, this.value());
    let next: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(5, active + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(1, active - 1);
        break;
      case 'Home':
        next = 1;
        break;
      case 'End':
        next = 5;
        break;
      default:
        if (/^[1-5]$/.test(event.key)) next = Number(event.key);
        break;
    }

    if (next === null) return;
    event.preventDefault();
    this.value.set(next);
    this.focusStar(next);
  }

  private focusStar(star: number): void {
    const button = this.starButtons()[star - 1];
    button?.nativeElement.focus();
  }
}
