import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { SCORES, type Score } from '../core/api/models';

/**
 * RF4 — "The rating control is operable by keyboard alone and announces itself.
 * Reachable by tab, settable without a pointer, visibly focused, and understood
 * by a screen reader as one control carrying a value out of five. A group of
 * five radios is a correct answer and often the best one."
 *
 * So it is five real radios in a real fieldset, and almost everything RF4 asks
 * for is then the platform's job rather than ours:
 *
 *   - the group is ONE tab stop, not five, because that is what a radio group
 *     is. Roving tabindex, arrow-key movement and wrapping all come from the
 *     browser and match the platform the user already knows. Home and End are
 *     not part of that: no browser implements them on a native radio group,
 *     and the ARIA pattern lists them as optional. Adding them by hand would
 *     mean a key handler in front of a control that does not need one;
 *   - a screen reader reads it as one control with a value out of five,
 *     because `fieldset` + `legend` + `name` is literally that;
 *   - each option is named for what it is — "1 star", "2 stars" — never five
 *     identical "star" labels, which page 7 writes down;
 *   - `:focus-visible` on the input draws the ring on its label, so the focused
 *     option is visible without a custom focus model.
 *
 * The value is `null` before anything is chosen — a first review opens with
 * nothing selected — and a `Score` when the caller is changing one. `null` is
 * not `0`: there is no zero-star review.
 *
 * The visual fill is bound from the signal rather than done with sibling
 * selectors, because the CSS trick for "fill up to N" needs the radios in
 * reverse DOM order, and that would reverse what the arrow keys do.
 */
@Component({
  selector: 'nud-rating-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="group" [disabled]="disabled()">
      <!--
        Visible, not visually-hidden. It is the group's accessible name either
        way, but a row of five stars with nothing next to it is a control a
        sighted user has to guess at — and it was one.
      -->
      <legend class="legend">{{ legend() }}</legend>

      <div class="stars" (mouseleave)="hovered.set(null)">
        @for (score of scores; track score) {
          <input
            class="radio"
            type="radio"
            [id]="optionId(score)"
            [name]="name()"
            [value]="score"
            [checked]="value() === score"
            (change)="choose(score)"
          />
          <label
            class="star"
            [class.star--filled]="score <= filled()"
            [class.star--preview]="hovered() !== null && score <= filled()"
            [for]="optionId(score)"
            (mouseenter)="hovered.set(score)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M12 2.6l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.1l6.1-.9L12 2.6z"
              />
            </svg>
            <span class="visually-hidden">{{ score }} {{ score === 1 ? 'star' : 'stars' }}</span>
          </label>
        }
      </div>
    </fieldset>
  `,
  styles: `
    .group {
      min-inline-size: 0;
      padding: 0;
      margin: 0;
      border: 0;
    }

    .legend {
      padding: 0;
      margin-block-end: var(--space-1);
      color: var(--text-secondary);
      font-size: var(--text-12);
      font-weight: 500;
    }

    .stars {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    /*
     * Present to assistive technology and to the keyboard, invisible on screen:
     * the label next to it is the thing you see. Not "display: none", which
     * would take it out of the tab order and out of the accessibility tree.
     */
    .radio {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: 0;
      opacity: 0;
      pointer-events: none;
    }

    .star {
      display: grid;
      place-items: center;
      /* Page 6: 44px minimum target. */
      inline-size: var(--target-min);
      block-size: var(--target-min);
      border-radius: var(--radius-control);
      color: var(--rating-track);
      cursor: pointer;
      transition:
        color var(--duration-fast) var(--ease),
        background-color var(--duration-fast) var(--ease),
        transform var(--duration-fast) var(--ease);
    }

    .star svg {
      inline-size: 28px;
      block-size: 28px;
      fill: currentColor;
    }

    .star--filled {
      color: var(--rating-mark);
    }

    /* A pointer preview is a candidate, not a choice. */
    .star--preview {
      opacity: 0.72;
    }

    .star:hover {
      background: var(--surface-hover);
    }

    .star:active {
      transform: scale(0.94);
    }

    /*
     * The ring belongs on the label because the input carrying focus is the
     * invisible one. Drawn only for :focus-visible, so a pointer click does not
     * leave a ring behind.
     */
    .radio:focus-visible + .star {
      outline: var(--focus-ring-width) solid var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
      background: var(--surface-hover);
    }

    .group:disabled .star {
      cursor: not-allowed;
      opacity: 0.55;
    }
  `,
})
export class RatingInputComponent {
  /** `null` until something is chosen. There is no zero-star review. */
  readonly value = model<Score | null>(null);

  /**
   * Radios are grouped by `name`, so two rating controls on one page must not
   * share it. Required rather than generated, so the grouping is visible at the
   * call site.
   */
  readonly name = input.required<string>();

  /** The group's accessible name, read once when focus enters it. */
  readonly legend = input('Your rating, out of five');

  readonly disabled = input(false);

  protected readonly scores = SCORES;
  protected readonly hovered = signal<Score | null>(null);

  /** How many stars are painted: the pointer preview if any, else the value. */
  protected readonly filled = computed(() => this.hovered() ?? this.value() ?? 0);

  protected optionId(score: Score): string {
    return `${this.name()}-${score}`;
  }

  protected choose(score: Score): void {
    this.value.set(score);
  }
}
