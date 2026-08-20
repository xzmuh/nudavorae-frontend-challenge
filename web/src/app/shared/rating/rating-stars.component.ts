import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Read-only star display with fractional fill. */
@Component({
  selector: 'app-rating-stars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="stars" [style.--star-size]="size() + 'px'" [attr.aria-label]="label()" role="img">
      <span class="row row--track" aria-hidden="true">
        @for (star of stars; track star) {
          <svg viewBox="0 0 24 24"><path [attr.d]="path" /></svg>
        }
      </span>
      <span class="row row--fill" aria-hidden="true" [style.width.%]="fillPercent()">
        @for (star of stars; track star) {
          <svg viewBox="0 0 24 24"><path [attr.d]="path" /></svg>
        }
      </span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .stars {
      position: relative;
      display: inline-block;
      line-height: 0;
      white-space: nowrap;
    }

    .row {
      display: inline-flex;
      gap: 2px;
    }

    .row--fill {
      position: absolute;
      inset: 0;
      overflow: hidden;
      color: var(--color-star);
    }

    .row--track {
      color: var(--color-border-strong);
    }

    svg {
      width: var(--star-size, 14px);
      height: var(--star-size, 14px);
      flex: none;
      fill: currentColor;
    }
  `,
})
export class RatingStarsComponent {
  readonly value = input<number>(0);
  readonly size = input<number>(14);
  readonly total = input<number>(5);

  protected readonly stars = [0, 1, 2, 3, 4];
  protected readonly path =
    'M12 2.6l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.1l6.1-.9L12 2.6z';

  readonly fillPercent = computed(() => {
    const ratio = Math.max(0, Math.min(1, this.value() / this.total()));
    return ratio * 100;
  });

  readonly label = computed(() => `${this.value().toFixed(1)} out of ${this.total()}`);
}
