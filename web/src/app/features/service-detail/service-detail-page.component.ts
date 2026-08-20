import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogStore } from '../../core/catalog/catalog-store.service';
import { toQueryParams } from '../../core/catalog/catalog-filters';
import { ServiceDetailStore } from '../../core/catalog/service-detail-store.service';
import { EmptyStateComponent } from '../../shared/states/empty-state.component';
import { ErrorStateComponent } from '../../shared/states/error-state.component';
import { ProtectedImageComponent } from '../../shared/protected-image/protected-image.component';
import { RatingInputComponent } from '../../shared/rating/rating-input.component';
import { RatingStarsComponent } from '../../shared/rating/rating-stars.component';
import { ServiceCardComponent } from '../../shared/service-card/service-card.component';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-service-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ServiceDetailStore],
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    RouterLink,
    ProtectedImageComponent,
    RatingInputComponent,
    RatingStarsComponent,
    ServiceCardComponent,
  ],
  templateUrl: './service-detail-page.component.html',
  styleUrl: './service-detail-page.component.css',
})
export class ServiceDetailPageComponent {
  private readonly store = inject(ServiceDetailStore);
  private readonly catalog = inject(CatalogStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  /** Bound from the route path parameter (`withComponentInputBinding`). */
  readonly id = input.required<string>();

  readonly status = this.store.status;
  readonly error = this.store.error;
  readonly service = this.store.service;
  readonly related = this.store.related;

  readonly reviews = this.store.reviews;
  readonly reviewsStatus = this.store.reviewsStatus;
  readonly reviewsError = this.store.reviewsError;
  readonly reviewsTotal = this.store.reviewsTotal;
  readonly reviewsHasMore = this.store.reviewsHasMore;
  readonly reviewsLoadingMore = this.store.reviewsLoadingMore;

  readonly submitting = this.store.submitting;
  readonly submitError = this.store.submitError;
  readonly submitted = this.store.submitted;

  protected readonly guarantees = [
    'Secure payment',
    'Watermarked delivery',
    'Private messaging',
    'Dispute support',
  ];

  readonly rating = signal(0);
  readonly comment = signal('');

  readonly activeImage = signal<string | null>(null);

  readonly catalogQueryParams = computed(() => toQueryParams(this.catalog.filters()));

  readonly gallery = computed<string[]>(() => {
    const service = this.service();
    if (service === null) return [];
    return [service.coverImageId, ...service.galleryImageIds];
  });

  readonly heroImage = computed<string | null>(() => {
    const selected = this.activeImage();
    if (selected !== null) return selected;
    return this.gallery()[0] ?? null;
  });

  readonly paragraphs = computed<string[]>(() => {
    const description = this.service()?.description ?? '';
    return description.split('\n\n').filter((block) => block.trim() !== '');
  });

  readonly canSubmit = computed(() => this.rating() > 0 && !this.submitting());

  constructor() {
    effect(() => {
      const serviceId = this.id();
      untracked(() => {
        this.activeImage.set(null);
        this.rating.set(0);
        this.comment.set('');
        this.store.load(serviceId);
      });
    });

    // A published review clears the form; a failed one keeps what was typed so
    // the reviewer can retry without retyping.
    effect(() => {
      if (!this.submitted()) return;
      untracked(() => {
        this.rating.set(0);
        this.comment.set('');
      });
    });
  }

  protected goBack(): void {
    const window = this.document.defaultView;
    if (window !== null && window.history.length > 1) {
      window.history.back();
      return;
    }
    void this.router.navigate(['/'], { queryParams: this.catalogQueryParams() });
  }

  protected selectImage(imageId: string): void {
    this.activeImage.set(imageId);
  }

  protected onCommentInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) this.comment.set(target.value);
  }

  protected submitReview(): void {
    if (!this.canSubmit()) return;
    this.store.submitReview(this.rating(), this.comment().trim());
  }

  protected retry(): void {
    this.store.retry();
  }

  protected retryReviews(): void {
    this.store.retryReviews();
  }

  protected loadMoreReviews(): void {
    this.store.loadMoreReviews();
  }

  protected dismissFeedback(): void {
    this.store.dismissSubmitFeedback();
  }

  protected clearForm(): void {
    this.rating.set(0);
    this.comment.set('');
  }
}
