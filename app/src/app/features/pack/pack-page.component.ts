import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { SCORES, type Score, formatHandle } from '../../core/api/models';
import { ProtectedImageComponent } from '../../ui/protected-image.component';
import { RatingInputComponent } from '../../ui/rating-input.component';
import { StatePanelComponent } from '../../ui/state-panel.component';
import { PackAsideComponent } from './pack-aside.component';
import { PackStore } from './pack-store';

const BLOCKED_COPY: Readonly<Record<string, { heading: string; body: string }>> = {
  not_purchased: {
    heading: 'Only buyers can review this pack',
    body: 'Reviews are open to accounts that bought the pack, so the score reflects what was delivered.',
  },
  already_reviewed: {
    heading: 'You have already reviewed this pack',
    body: 'One review per buyer, and yours is already counted in the average above.',
  },
  pack_removed: {
    heading: 'This pack is no longer on sale',
    body: 'The creator removed it. Existing reviews stay, and no new ones can be added.',
  },
};

@Component({
  selector: 'nud-pack-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Component-scoped: nothing about one pack may survive into the next.
  providers: [PackStore],
  imports: [
    RouterLink,
    PackAsideComponent,
    ProtectedImageComponent,
    RatingInputComponent,
    StatePanelComponent,
  ],
  templateUrl: './pack-page.component.html',
  styleUrl: './pack-page.component.css',
})
export class PackPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly document = inject(DOCUMENT);

  protected readonly store = inject(PackStore);
  protected readonly scores = SCORES;

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly packId = computed(() => this.params().get('id') ?? '');

  /** The form's own state. Never cleared by a failure (RF7). */
  protected readonly score = signal<Score | null>(null);
  protected readonly body = signal('');
  private readonly touched = signal(false);

  protected readonly handle = computed(() => {
    const pack = this.store.pack();
    return pack === null ? '' : formatHandle(pack.creatorHandle);
  });

  /** Mirrors the document, so the button's label survives Escape and F11. */
  protected readonly isFullscreen = signal(false);

  protected readonly authorOf = formatHandle;

  /** Percentages for the five bars. Zero reviews means five empty bars. */
  protected readonly distribution = computed(() => {
    const pack = this.store.pack();
    if (pack === null) return [];
    const total = SCORES.reduce((sum, score) => sum + pack.distribution[score], 0);
    return [...SCORES].reverse().map((score) => {
      const count = pack.distribution[score];
      return { score, count, percent: total === 0 ? 0 : Math.round((count / total) * 100) };
    });
  });

  protected readonly canSubmit = computed(
    () => this.score() !== null && !this.store.submitting(),
  );

  protected readonly blocked = computed(() => {
    const permission = this.store.permission();
    return permission.kind === 'blocked' ? BLOCKED_COPY[permission.reason] ?? null : null;
  });

  constructor() {
    effect(() => {
      const id = this.packId();
      if (id !== '') this.store.load(id);
    });

    // Prefilled when the caller is changing a review, empty on a first one —
    // and never overwriting what the person has already typed, including after
    // a failed submit put the old permission back.
    effect(() => {
      const permission = this.store.permission();
      if (permission.kind !== 'can-change' || this.touched()) return;
      this.score.set(permission.own.score);
      this.body.set(permission.own.body);
    });

    let announced: string | null = null;
    effect(() => {
      const message = this.statusMessage();
      if (message === null || message === announced) return;
      announced = message;
      this.announcer.announce(message, 'polite');
    });

    // Escape and F11 leave fullscreen without going through the button, so the
    // label reads the document rather than remembering what it last did.
    const sync = () => this.isFullscreen.set(this.document.fullscreenElement !== null);
    this.document.addEventListener('fullscreenchange', sync);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('fullscreenchange', sync);
    });
  }

  /**
   * The browser's own fullscreen rather than a hand-built lightbox: Escape, the
   * focus trap and the OS chrome all come with it. A rejected request — an
   * iframe without the permission, a user gesture the browser did not count —
   * leaves the page exactly as it was, which is the right outcome.
   */
  protected toggleFullscreen(element: HTMLElement): void {
    if (this.document.fullscreenElement !== null) {
      void this.document.exitFullscreen().catch(() => undefined);
      return;
    }
    void element.requestFullscreen?.().catch(() => undefined);
  }

  protected onBody(value: string): void {
    this.touched.set(true);
    this.body.set(value);
  }

  protected onScore(value: Score | null): void {
    this.touched.set(true);
    this.score.set(value);
  }

  /**
   * RF7. The guard that matters lives in the store; this only stops the browser
   * from navigating and hands over what was typed.
   */
  protected onSubmit(event: Event): void {
    event.preventDefault();
    const score = this.score();
    if (score === null) return;
    this.store.submit(score, this.body());
  }

  private statusMessage(): string | null {
    switch (this.store.status()) {
      case 'loading':
        return 'Loading pack.';
      case 'error':
        return `The pack could not be loaded. ${this.store.error()?.message ?? ''}`.trim();
      case 'ready': {
        const pack = this.store.pack();
        if (pack === null) return null;
        const rating = pack.rating === null ? 'not rated yet' : `rated ${pack.rating} out of 5`;
        return `${pack.title}, ${rating}, ${pack.reviewCount} reviews.`;
      }
      default:
        return null;
    }
  }
}
