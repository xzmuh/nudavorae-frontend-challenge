import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { PacksApiService } from '../core/api/packs-api.service';

/**
 * RF3 — "Covers are private. They need the Authorization header, so <img src>
 * cannot fetch them: a fetch plus an object URL is the expected answer [...]
 * Whatever you create is released when the thing that created it is destroyed."
 *
 * Which is why there is no cache here, and deliberately so. A root-held map of
 * object URLs would make a back navigation cheaper, but it would also be an
 * object URL outliving the component that created it, and page 7 ends the
 * process on exactly that. RF6 settles the trade for us in the same breath:
 * "Covers may be fetched again on the way back, because the HTTP cache makes
 * that free. It is the cards that must not be." The stub sends
 * `cache-control: private, max-age=300` on `/media`, so the second fetch never
 * leaves the browser.
 *
 * One object URL exists per instance at a time. It is revoked when the media id
 * changes and when the component is destroyed, in both cases before anything
 * else can take its place.
 */
@Component({
  selector: 'nud-protected-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let url = objectUrl();
    @if (url !== null) {
      <img
        [src]="url"
        [alt]="alt()"
        [attr.width]="width()"
        [attr.height]="height()"
        [style.object-fit]="fit()"
      />
    } @else if (failed()) {
      <div class="placeholder placeholder--failed" role="img" [attr.aria-label]="failedLabel()">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-13Zm2.2 13.3h13.6L14 12l-3 3.8-2-2.4-3.8 5.4Z"
          />
        </svg>
      </div>
    } @else {
      <div class="placeholder placeholder--loading" aria-hidden="true"></div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      overflow: hidden;
      background: var(--surface-skeleton);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .placeholder {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      color: var(--text-muted);
    }

    /* Page 6: nothing but the brand mark is a gradient. */
    .placeholder--loading {
      background: var(--surface-skeleton);
      animation: pulse 1.4s var(--ease) infinite alternate;
    }

    .placeholder--failed svg {
      width: 28px;
      height: 28px;
      fill: currentColor;
      opacity: 0.55;
    }

    @keyframes pulse {
      from {
        opacity: 0.55;
      }
      to {
        opacity: 1;
      }
    }
  `,
})
export class ProtectedImageComponent {
  private readonly api = inject(PacksApiService);

  readonly mediaId = input.required<string>();
  readonly alt = input.required<string>();
  readonly width = input<number | null>(null);
  readonly height = input<number | null>(null);
  /**
   * `cover` for a card or a hero, where the frame is the fixed thing; `contain`
   * where the picture is — fullscreen, and nowhere else so far.
   */
  readonly fit = input<'cover' | 'contain'>('cover');

  protected readonly objectUrl = signal<string | null>(null);
  protected readonly failed = signal(false);
  protected readonly failedLabel = computed(() => `${this.alt()} — cover unavailable`);

  /** The one URL this instance currently owns, and therefore must revoke. */
  private owned: string | null = null;

  constructor() {
    toObservable(this.mediaId)
      .pipe(
        switchMap((mediaId) =>
          this.api.media(mediaId).pipe(
            map((blob) => ({ url: URL.createObjectURL(blob), failed: false })),
            catchError(() => of({ url: null, failed: true })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ url, failed }) => {
        this.release();
        this.owned = url;
        this.objectUrl.set(url);
        this.failed.set(failed);
      });

    inject(DestroyRef).onDestroy(() => this.release());
  }

  private release(): void {
    if (this.owned === null) return;
    URL.revokeObjectURL(this.owned);
    this.owned = null;
  }
}
