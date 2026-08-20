import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ServiceListItem } from '../../core/api/models';
import { ProtectedImageComponent } from '../protected-image/protected-image.component';
import { RatingStarsComponent } from '../rating/rating-stars.component';

const LEVEL_LABELS: Record<string, string> = {
  new: 'New seller',
  rising: 'Rising talent',
  top: 'Top rated',
  elite: 'Elite',
};

@Component({
  selector: 'app-service-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, DecimalPipe, ProtectedImageComponent, RatingStarsComponent],
  template: `
    <a class="card" [routerLink]="['/services', service().id]">
      <div class="media">
        <app-protected-image
          [imageId]="service().coverImageId"
          [alt]="service().title"
          ratio="16 / 10"
        />
        @if (levelLabel(); as level) {
          <span class="chip chip--accent level">{{ level }}</span>
        }
      </div>

      <div class="body">
        <div class="seller">
          <span class="avatar">
            <app-protected-image
              [imageId]="service().seller.avatarImageId"
              [alt]="service().seller.name"
              ratio="1 / 1"
            />
          </span>
          <span class="handle">{{ '@' + service().seller.handle }}</span>
          @if (service().seller.verified) {
            <svg class="verified" viewBox="0 0 24 24" aria-label="Verified seller">
              <path
                d="m12 1.8 2.5 2 3.2-.2.9 3 2.6 1.8-1.2 3 1.2 3-2.6 1.8-.9 3-3.2-.2-2.5 2-2.5-2-3.2.2-.9-3L3.8 15.4l1.2-3-1.2-3 2.6-1.8.9-3 3.2.2 2.5-2Zm-1 12.9 5-5-1.4-1.4-3.6 3.6-1.6-1.6L8 11.7l3 3Z"
                fill="currentColor"
              />
            </svg>
          }
        </div>

        <h3 class="title">{{ service().title }}</h3>

        <div class="rating">
          @if (service().ratingCount > 0) {
            <app-rating-stars [value]="service().ratingAvg" [size]="13" />
            <strong>{{ service().ratingAvg | number: '1.1-1' }}</strong>
            <span class="muted">({{ service().ratingCount | number }})</span>
          } @else {
            <span class="muted">No reviews yet</span>
          }
        </div>

        <div class="footer">
          <span class="price">{{ service().priceCents / 100 | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
          <span class="muted">{{ service().deliveryDays }}d delivery</span>
        </div>
      </div>
    </a>
  `,
  styles: `
    :host {
      display: block;
    }

    .card {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: var(--color-surface);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-lg);
      transition:
        transform var(--duration-base) var(--ease-out),
        border-color var(--duration-base) var(--ease-out),
        box-shadow var(--duration-base) var(--ease-out);
    }

    .card:hover {
      transform: translateY(-3px);
      border-color: var(--color-border-strong);
      box-shadow: var(--shadow-md);
    }

    .card:focus-visible {
      outline: var(--focus-ring-width) solid var(--color-accent);
      outline-offset: var(--focus-ring-offset);
    }

    .media {
      position: relative;
    }

    .level {
      position: absolute;
      left: var(--space-3);
      top: var(--space-3);
      backdrop-filter: blur(8px);
    }

    .body {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-4);
    }

    .seller {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
    }

    .avatar {
      display: block;
      width: 22px;
      flex: none;
      overflow: hidden;
      border-radius: var(--radius-pill);
    }

    .handle {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .verified {
      width: 14px;
      height: 14px;
      flex: none;
      color: var(--color-accent);
    }

    .title {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 2.4em;
      font-family: var(--font-body);
      font-size: var(--text-md);
      font-weight: var(--weight-semibold);
      line-height: var(--leading-snug);
      letter-spacing: var(--tracking-normal);
    }

    .rating {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xs);
    }

    .muted {
      color: var(--color-text-subtle);
    }

    .footer {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
      margin-top: var(--space-1);
      padding-top: var(--space-3);
      border-top: var(--border-width) solid var(--color-border-subtle);
      font-size: var(--text-xs);
    }

    .price {
      font-family: var(--font-display);
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      letter-spacing: var(--tracking-tight);
    }
  `,
})
export class ServiceCardComponent {
  readonly service = input.required<ServiceListItem>();

  readonly levelLabel = computed(() => {
    const level = this.service().seller.level;
    return level === 'top' || level === 'elite' ? (LEVEL_LABELS[level] ?? null) : null;
  });
}
