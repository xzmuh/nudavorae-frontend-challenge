import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type PackCard, formatHandle, formatPrice } from '../core/api/models';
import { ProtectedImageComponent } from './protected-image.component';

/**
 * One card. Rendered inside the catalogue's `<li>`, so this component is the
 * contents of a list item and never the list itself.
 *
 * The whole card is clickable, but there is exactly one link in it: the title's
 * anchor is stretched over the card with a pseudo-element. A second anchor
 * around the cover would read as two links to the same place, and a `div` with
 * a click handler is on page 7's list of things they always write down.
 */
@Component({
  selector: 'nud-pack-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProtectedImageComponent],
  template: `
    @let item = pack();

    <article class="card">
      <nud-protected-image
        class="card__cover"
        [mediaId]="item.coverMediaId"
        [alt]="'Cover of ' + item.title"
        [width]="640"
        [height]="480"
      />

      <div class="card__body">
        <h3 class="card__title">
          <a class="card__link" [routerLink]="['/packs', item.id]">{{ item.title }}</a>
        </h3>

        <p class="card__creator mono">{{ handle() }}</p>

        <div class="card__meta">
          <span class="card__price mono">{{ price() }}</span>

          @if (item.rating !== null) {
            <span class="card__rating mono">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M12 2.6l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.1l6.1-.9L12 2.6z"
                />
              </svg>
              <span class="visually-hidden">Rated</span>
              {{ item.rating }}
              <span class="visually-hidden">out of 5</span>
            </span>
          } @else {
            <span class="card__unrated">Not rated yet</span>
          }
        </div>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
      block-size: 100%;
    }

    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      block-size: 100%;
      overflow: hidden;
      /* Page 6: radius 14 on cards. */
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-card);
      background: var(--surface-raised);
      transition:
        border-color var(--duration-slow) var(--ease),
        box-shadow var(--duration-slow) var(--ease),
        transform var(--duration-slow) var(--ease);
    }

    .card:hover {
      border-color: var(--border-strong);
      box-shadow: var(--shadow-raised);
      transform: translateY(-2px);
    }

    /* The ring belongs to the card, because the link covers the card. */
    .card:has(.card__link:focus-visible) {
      outline: var(--focus-ring-width) solid var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    .card__cover {
      aspect-ratio: 4 / 3;
      /* Page 6: radius 4 inside a card. */
      border-end-end-radius: var(--radius-inset);
      border-end-start-radius: var(--radius-inset);
    }

    .card__body {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      flex: 1;
      padding: var(--space-3) var(--space-4) var(--space-4);
    }

    .card__title {
      font-size: var(--text-16);
      font-weight: 600;
    }

    .card__link {
      text-decoration: none;
    }

    /* Stretches the one link over the whole card. */
    .card__link::after {
      content: '';
      position: absolute;
      inset: 0;
    }

    .card__link:focus-visible {
      outline: none;
    }

    .card__creator {
      color: var(--text-muted);
      font-size: var(--text-12);
    }

    .card__meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      margin-block-start: auto;
      padding-block-start: var(--space-2);
    }

    /* 600, not 500: Plex Mono ships as the 400 and 600 the design uses. */
    .card__price {
      font-size: var(--text-18);
      font-weight: 600;
    }

    .card__rating {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--text-secondary);
      font-size: var(--text-14);
    }

    .card__rating svg {
      inline-size: 15px;
      block-size: 15px;
      fill: var(--rating-mark);
    }

    .card__unrated {
      color: var(--text-muted);
      font-size: var(--text-12);
    }
  `,
})
export class PackCardComponent {
  readonly pack = input.required<PackCard>();

  protected readonly price = computed(() => formatPrice(this.pack().priceCents));
  protected readonly handle = computed(() => formatHandle(this.pack().creatorHandle));
}
