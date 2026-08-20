import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiError, asApiError } from '../api/api-error';
import { CatalogApiService } from '../api/catalog-api.service';
import type { Review, ServiceDetail, ServiceListItem } from '../api/models';
import { CatalogStore } from './catalog-store.service';

export type DetailStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
export type ReviewsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface OptimisticSnapshot {
  ratingAvg: number;
  ratingCount: number;
  reviews: Review[];
  reviewsTotal: number;
  reviewsStatus: ReviewsStatus;
}

/**
 * State of a single service page. Provided by the route component, so every
 * navigation starts from a clean slate.
 */
@Injectable()
export class ServiceDetailStore {
  private readonly api = inject(CatalogApiService);
  private readonly catalog = inject(CatalogStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly serviceSignal = signal<ServiceDetail | null>(null);
  private readonly relatedSignal = signal<ServiceListItem[]>([]);
  private readonly statusSignal = signal<DetailStatus>('idle');
  private readonly errorSignal = signal<ApiError | null>(null);

  private readonly reviewsSignal = signal<Review[]>([]);
  private readonly reviewsStatusSignal = signal<ReviewsStatus>('idle');
  private readonly reviewsErrorSignal = signal<ApiError | null>(null);
  private readonly reviewsTotalSignal = signal(0);
  private readonly reviewsPageSignal = signal(0);
  private readonly reviewsHasMoreSignal = signal(false);
  private readonly reviewsLoadingMoreSignal = signal(false);

  private readonly submittingSignal = signal(false);
  private readonly submitErrorSignal = signal<ApiError | null>(null);
  private readonly submittedSignal = signal(false);

  private serviceId = '';

  readonly service = this.serviceSignal.asReadonly();
  readonly related = this.relatedSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly reviews = this.reviewsSignal.asReadonly();
  readonly reviewsStatus = this.reviewsStatusSignal.asReadonly();
  readonly reviewsError = this.reviewsErrorSignal.asReadonly();
  readonly reviewsTotal = this.reviewsTotalSignal.asReadonly();
  readonly reviewsHasMore = this.reviewsHasMoreSignal.asReadonly();
  readonly reviewsLoadingMore = this.reviewsLoadingMoreSignal.asReadonly();

  readonly submitting = this.submittingSignal.asReadonly();
  readonly submitError = this.submitErrorSignal.asReadonly();
  readonly submitted = this.submittedSignal.asReadonly();

  readonly ratingAvg = computed(() => this.serviceSignal()?.ratingAvg ?? 0);
  readonly ratingCount = computed(() => this.serviceSignal()?.ratingCount ?? 0);

  load(serviceId: string): void {
    this.serviceId = serviceId;
    this.statusSignal.set('loading');
    this.errorSignal.set(null);

    this.api
      .detail(serviceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.serviceSignal.set(response.service);
          this.relatedSignal.set(response.related);
          this.statusSignal.set('ready');
          this.loadReviews(1);
        },
        error: (error: unknown) => {
          const apiError = asApiError(error);
          if (apiError.isNotFound) {
            this.statusSignal.set('empty');
            this.errorSignal.set(null);
            return;
          }
          this.errorSignal.set(apiError);
          this.statusSignal.set('error');
        },
      });
  }

  retry(): void {
    if (this.serviceId !== '') this.load(this.serviceId);
  }

  loadMoreReviews(): void {
    if (!this.reviewsHasMoreSignal() || this.reviewsLoadingMoreSignal()) return;
    this.reviewsLoadingMoreSignal.set(true);
    this.loadReviews(this.reviewsPageSignal() + 1);
  }

  retryReviews(): void {
    this.loadReviews(1);
  }

  private loadReviews(page: number): void {
    if (page === 1) {
      this.reviewsStatusSignal.set('loading');
      this.reviewsErrorSignal.set(null);
    }

    this.api
      .reviews(this.serviceId, page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.reviewsPageSignal.set(response.page);
          this.reviewsTotalSignal.set(response.total);
          this.reviewsHasMoreSignal.set(response.hasMore);
          this.reviewsLoadingMoreSignal.set(false);
          this.reviewsSignal.update((current) =>
            page === 1 ? response.items : [...current, ...response.items],
          );
          this.reviewsStatusSignal.set(this.reviewsSignal().length === 0 ? 'empty' : 'ready');
        },
        error: (error: unknown) => {
          this.reviewsLoadingMoreSignal.set(false);
          this.reviewsErrorSignal.set(asApiError(error));
          if (page === 1) this.reviewsStatusSignal.set('error');
        },
      });
  }

  /**
   * Publishes a review. The average moves the moment the button is pressed and
   * the whole change (average, count and the review itself) is rolled back if
   * the request fails.
   */
  submitReview(rating: number, comment: string): void {
    const service = this.serviceSignal();
    if (service === null || this.submittingSignal()) return;

    const snapshot: OptimisticSnapshot = {
      ratingAvg: service.ratingAvg,
      ratingCount: service.ratingCount,
      reviews: this.reviewsSignal(),
      reviewsTotal: this.reviewsTotalSignal(),
      reviewsStatus: this.reviewsStatusSignal(),
    };

    const optimisticId = `optimistic-${service.id}-${snapshot.reviewsTotal + 1}`;
    const nextCount = snapshot.ratingCount + 1;
    const nextAvg = (snapshot.ratingAvg * snapshot.ratingCount + rating) / nextCount;

    const optimisticReview: Review = {
      id: optimisticId,
      serviceId: service.id,
      authorName: 'You',
      authorHandle: 'you.demo',
      authorAvatarImageId: 'avatar-you-demo-0',
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };

    this.submittingSignal.set(true);
    this.submitErrorSignal.set(null);
    this.submittedSignal.set(false);
    this.applyRating(nextAvg, nextCount);
    this.reviewsSignal.update((current) => [optimisticReview, ...current]);
    this.reviewsTotalSignal.update((total) => total + 1);
    this.reviewsStatusSignal.set('ready');

    this.api
      .createReview(service.id, { rating, comment })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submittingSignal.set(false);
          this.submittedSignal.set(true);
          this.applyRating(response.ratingAvg, response.ratingCount);
          this.reviewsSignal.update((current) =>
            current.map((review) => (review.id === optimisticId ? response.review : review)),
          );
        },
        error: (error: unknown) => {
          this.submittingSignal.set(false);
          this.submitErrorSignal.set(asApiError(error));
          // Rollback: everything goes back to the pre-publish snapshot.
          this.applyRating(snapshot.ratingAvg, snapshot.ratingCount);
          this.reviewsSignal.set(snapshot.reviews);
          this.reviewsTotalSignal.set(snapshot.reviewsTotal);
          this.reviewsStatusSignal.set(snapshot.reviewsStatus);
        },
      });
  }

  dismissSubmitFeedback(): void {
    this.submitErrorSignal.set(null);
    this.submittedSignal.set(false);
  }

  private applyRating(ratingAvg: number, ratingCount: number): void {
    this.serviceSignal.update((current) =>
      current === null ? current : { ...current, ratingAvg, ratingCount },
    );
    const service = this.serviceSignal();
    if (service !== null) {
      // The card in the cached list must show the same average when you go back.
      this.catalog.patchItem(service.id, { ratingAvg, ratingCount });
    }
  }
}
