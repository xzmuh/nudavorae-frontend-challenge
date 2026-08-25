import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { type ApiError, toApiError } from '../../core/api/api-error';
import {
  type Distribution,
  type Pack,
  type Review,
  type ReviewPermission,
  SCORES,
  type Score,
} from '../../core/api/models';
import { VIEWER_HANDLE } from '../../core/api/contract';
import { PacksApiService } from '../../core/api/packs-api.service';
import { CatalogueStore } from '../../core/catalogue/catalogue-store';

export type PackStatus = 'loading' | 'ready' | 'error';

/** Exact, because a distribution is absolute counts and never a rounded figure. */
function averageOf(distribution: Distribution): string | null {
  let count = 0;
  let total = 0;
  for (const score of SCORES) {
    count += distribution[score];
    total += score * distribution[score];
  }
  if (count === 0) return null;
  return (Math.round((total / count) * 10) / 10).toFixed(1);
}

function countOf(distribution: Distribution): number {
  return SCORES.reduce((sum, score) => sum + distribution[score], 0);
}

function withScore(
  distribution: Distribution,
  add: Score,
  remove: Score | null,
): Distribution {
  const next: Record<Score, number> = { ...distribution };
  if (remove !== null) next[remove] = Math.max(0, next[remove] - 1);
  next[add] += 1;
  return next;
}

interface Snapshot {
  readonly pack: Pack;
  readonly reviews: readonly Review[];
  readonly permission: ReviewPermission;
}

/**
 * Everything the pack screen knows, and nothing that outlives it.
 *
 * Provided by the route component rather than in root: RF6 needs the catalogue
 * to survive a navigation, and nothing here does. A second pack must not
 * inherit the first one's reviews, and the truth for a pack is one request
 * away.
 */
@Injectable()
export class PackStore {
  private readonly api = inject(PacksApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly catalogue = inject(CatalogueStore);
  private readonly loads = new Subject<string>();

  private readonly packSignal = signal<Pack | null>(null);
  private readonly reviewsSignal = signal<readonly Review[]>([]);
  private readonly permissionSignal = signal<ReviewPermission>({ kind: 'can-write' });
  private readonly statusSignal = signal<PackStatus>('loading');
  private readonly errorSignal = signal<ApiError | null>(null);

  /** RF7: the one flag that makes a second submit impossible. */
  private readonly submittingSignal = signal(false);
  private readonly submitErrorSignal = signal<ApiError | null>(null);

  private packId: string | null = null;

  readonly pack = this.packSignal.asReadonly();
  readonly reviews = this.reviewsSignal.asReadonly();
  readonly permission = this.permissionSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly submitting = this.submittingSignal.asReadonly();
  readonly submitError = this.submitErrorSignal.asReadonly();

  readonly reviewCount = computed(() => this.packSignal()?.reviewCount ?? 0);

  constructor() {
    this.loads
      .pipe(
        switchMap((id) =>
          forkJoin({ pack: this.api.pack(id), reviews: this.api.reviews(id) }).pipe(
            map((result) => ({ ...result, error: null })),
            catchError((cause: unknown) =>
              of({ pack: null, reviews: null, error: toApiError(cause) }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (result.error !== null) {
          this.errorSignal.set(result.error);
          this.statusSignal.set('error');
          return;
        }
        this.packSignal.set(result.pack);
        this.reviewsSignal.set(result.reviews.items);
        this.permissionSignal.set(result.reviews.permission);
        this.errorSignal.set(null);
        this.statusSignal.set('ready');
      });
  }

  load(id: string): void {
    this.packId = id;
    this.statusSignal.set('loading');
    this.errorSignal.set(null);
    this.submitErrorSignal.set(null);
    this.loads.next(id);
  }

  retry(): void {
    if (this.packId !== null) this.load(this.packId);
  }

  /**
   * RF5 — "Posting a review updates the average on screen at once, and if the
   * request fails the screen returns to the truth and says what happened. An
   * optimistic update with no rollback is worse than no optimistic update."
   *
   * RF7 — "The review form cannot be sent twice [...] Double-click the button,
   * or press enter again while the first request is in flight: one request
   * leaves the browser."
   *
   * The guard is the first statement of the method, not a `disabled` attribute.
   * A disabled button is what the user sees; it is not what stops a second
   * call, because the second click can be dispatched before the attribute is
   * painted, and Enter on a form does not need the button at all.
   *
   * The optimistic average is computed from the distribution rather than from
   * the current average, because the distribution is exact counts and the
   * average is a figure already rounded to one decimal. Rounding a rounded
   * number is how a screen ends up one tenth away from the truth and never
   * comes back.
   */
  submit(score: Score, body: string): void {
    if (this.submittingSignal()) return;

    const pack = this.packSignal();
    const id = this.packId;
    if (pack === null || id === null) return;

    const snapshot: Snapshot = {
      pack,
      reviews: this.reviewsSignal(),
      permission: this.permissionSignal(),
    };

    this.submittingSignal.set(true);
    this.submitErrorSignal.set(null);
    this.applyOptimistic(pack, score, body, snapshot.permission);

    this.api
      .postReview(id, score, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (update) => {
          // The server's figures replace the guess, so the screen ends on the
          // truth rather than on a good approximation of it.
          this.packSignal.update((current) =>
            current === null
              ? current
              : { ...current, rating: update.rating, reviewCount: update.reviewCount },
          );
          this.catalogue.patchRating(id, update.rating);
          this.submittingSignal.set(false);
        },
        error: (cause: unknown) => {
          // Back to the truth, and say what happened.
          this.packSignal.set(snapshot.pack);
          this.reviewsSignal.set(snapshot.reviews);
          this.permissionSignal.set(snapshot.permission);
          this.catalogue.patchRating(id, snapshot.pack.rating);
          this.submitErrorSignal.set(toApiError(cause));
          this.submittingSignal.set(false);
        },
      });
  }

  private applyOptimistic(
    pack: Pack,
    score: Score,
    body: string,
    permission: ReviewPermission,
  ): void {
    const replacing = permission.kind === 'can-change' ? permission.own : null;
    const distribution = withScore(pack.distribution, score, replacing?.score ?? null);

    this.packSignal.set({
      ...pack,
      distribution,
      rating: averageOf(distribution),
      reviewCount: countOf(distribution),
    });

    const own: Review = {
      id: replacing?.id ?? 'optimistic-own-review',
      authorHandle: VIEWER_HANDLE,
      score,
      body,
      createdAt: new Date().toISOString(),
    };

    this.reviewsSignal.update((items) =>
      replacing === null
        ? [own, ...items]
        : items.map((item) => (item.id === replacing.id ? own : item)),
    );
    this.permissionSignal.set({ kind: 'can-change', own });
    this.catalogue.patchRating(pack.id, averageOf(distribution));
  }
}
