import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type Pack, formatPrice } from '../../core/api/models';

/**
 * The right-hand column of the pack screen: what this costs and what buying it
 * gets you. Split out of the page because it answers "should I buy this" rather
 * than "what is this", and because the page had grown two unrelated stylesheets
 * in one file.
 *
 * It reads one input and holds no state, so it can be sticky, re-rendered or
 * moved above the fold on a narrow screen without anything else changing.
 */

/**
 * What the marketplace promises about every pack, rather than about this one.
 * Copy, not data: it belongs next to the price because that is the moment it
 * answers a question, and it says the same thing on all sixty packs.
 */
const ASSURANCES: readonly string[] = [
  'Secure payment',
  'Watermarked delivery',
  'Private messaging',
  'Dispute support',
];

@Component({
  selector: 'nud-pack-aside',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="buy-heading">
      <h2 id="buy-heading" class="eyebrow">One-time price</h2>

      <p class="price">
        <span class="price__amount mono">{{ price() }}</span>
        <span class="price__term">lifetime access</span>
      </p>

      <p class="delivery">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 3a1 1 0 0 1 1 1v9.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4l3.3 3.3V4a1 1 0 0 1 1-1Zm-8 15a1 1 0 0 1 1 1v1h14v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
          />
        </svg>
        Available right after payment clears
      </p>

      <!-- DECISIONS.md: checkout is out of scope, so these two are surface. -->
      <button type="button" class="button button--primary cta">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M2 3a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 .8L6 5h14a1 1 0 0 1 1 1.2l-1.3 6a2 2 0 0 1-2 1.6H8.5a2 2 0 0 1-2-1.6L4.8 4H3a1 1 0 0 1-1-1Zm6 15a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm9 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
          />
        </svg>
        Buy pack
      </button>

      <button type="button" class="button cta">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 3c5 0 9 3.3 9 7.5 0 4.2-4 7.5-9 7.5a11 11 0 0 1-2.5-.3l-4 2.1a.8.8 0 0 1-1.1-.9l.7-3A7.1 7.1 0 0 1 3 10.5C3 6.3 7 3 12 3Z"
          />
        </svg>
        Message creator
      </button>

      <!--
        Four assurances, and one icon for all four: the reference draws two of
        them hollow and two filled, which reads as a state rather than as
        decoration.
      -->
      <ul class="assurances">
        @for (assurance of assurances; track assurance) {
          <li class="assurances__item">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm4.7 6.8a1 1 0 0 0-1.4 0L11 13.1l-1.8-1.8a1 1 0 1 0-1.4 1.4l2.5 2.5a1 1 0 0 0 1.4 0l5-5a1 1 0 0 0 0-1.4Z"
              />
            </svg>
            {{ assurance }}
          </li>
        }
      </ul>

      <p class="fine">
        Your access does not expire. Every file you download is watermarked to your account, and
        redistribution ends the access.
      </p>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .panel {
      padding: var(--space-6);
      border: 1px solid var(--border-subtle);
      /* Page 6: radius 20 on sheets. */
      border-radius: var(--radius-sheet);
      background: var(--surface-raised);
    }

    .eyebrow {
      color: var(--text-muted);
      font-size: var(--text-12);
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .price {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-2);
      margin-block-start: var(--space-1);
    }

    /* 600, not 500: Plex Mono ships as the 400 and 600 the design uses. */
    .price__amount {
      font-size: var(--text-30);
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .price__term {
      color: var(--text-muted);
      font-size: var(--text-14);
    }

    .delivery {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-block-start: var(--space-2);
      color: var(--text-secondary);
      font-size: var(--text-14);
    }

    .delivery svg {
      inline-size: 15px;
      block-size: 15px;
      flex: none;
      fill: var(--text-muted);
    }

    .cta {
      inline-size: 100%;
      margin-block-start: var(--space-3);
    }

    .assurances {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-2) var(--space-3);
      margin-block-start: var(--space-6);
      padding-block-start: var(--space-6);
      border-block-start: 1px solid var(--border-subtle);
      list-style: none;
      padding-inline: 0;
    }

    .assurances__item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      color: var(--text-secondary);
      font-size: var(--text-12);
      line-height: var(--leading-snug);
    }

    .assurances__item svg {
      inline-size: 14px;
      block-size: 14px;
      flex: none;
      margin-block-start: 1px;
      fill: var(--status-success);
    }

    .fine {
      margin-block-start: var(--space-4);
      padding: var(--space-3);
      border-radius: var(--radius-card);
      background: var(--surface-hover);
      /* Secondary, not muted: this sits on a tinted surface rather than on the
         panel, and muted on that ground is 4.28:1 — fine print is still text. */
      color: var(--text-secondary);
      font-size: var(--text-12);
      line-height: var(--leading-snug);
    }
  `,
})
export class PackAsideComponent {
  readonly pack = input.required<Pack>();

  protected readonly assurances = ASSURANCES;

  protected readonly price = computed(() => formatPrice(this.pack().priceCents));
}
