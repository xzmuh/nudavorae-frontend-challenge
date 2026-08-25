import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import {
  type DistributionDto,
  type PackDetailDto,
  type PackListItemDto,
  type PacksPageDto,
  type PostReviewDto,
  type ReviewDto,
  type ReviewsDto,
  VIEWER_HANDLE,
} from './contract';
import type {
  Distribution,
  Pack,
  PackCard,
  PackPage,
  RatingUpdate,
  Review,
  ReviewPermission,
  Reviews,
  Score,
  SortKey,
} from './models';

/** Where the stub listens. Page 2: port 4010. */
export const STUB_ORIGIN = new InjectionToken<string>('STUB_ORIGIN', {
  providedIn: 'root',
  factory: () => 'http://localhost:4010',
});

/** Sixty packs over three pages of "load more". */
export const PAGE_LIMIT = 20;

export interface CatalogueQuery {
  readonly q: string;
  readonly sort: SortKey;
}

function toCard(dto: PackListItemDto): PackCard {
  return {
    id: dto.id,
    title: dto.title,
    creatorHandle: dto.creator_handle,
    priceCents: dto.price_cents,
    coverMediaId: dto.cover_media_id,
    rating: dto.rating,
  };
}

function toDistribution(dto: DistributionDto): Distribution {
  return { 1: dto['1'], 2: dto['2'], 3: dto['3'], 4: dto['4'], 5: dto['5'] };
}

function toReview(dto: ReviewDto): Review {
  return {
    id: dto.id,
    authorHandle: dto.author_handle,
    score: dto.score as Score,
    body: dto.body,
    createdAt: dto.created_at,
  };
}

/**
 * Collapses `can_review`, `reason` and the viewer's own review into the single
 * value the screen renders. Doing it here means the template can never show
 * two of the three answers at once, or none of them.
 *
 * Page 2 asks for three answers — write one, change the one you left, or the
 * reason there is nothing to offer — and the contract carries two fields. The
 * third is inferred: `already_reviewed` is "change the one you left" only when
 * that review is actually in the list the same response carried. When it is
 * not, the honest answer is the reason, because there is nothing on the screen
 * to change. In the committed seed it never is; after a `POST` from this
 * browser it always is, because that is the review the stub attributes to
 * `you`.
 */
function toPermission(dto: ReviewsDto, items: readonly Review[]): ReviewPermission {
  if (dto.can_review) return { kind: 'can-write' };

  const own = items.find((review) => review.authorHandle === VIEWER_HANDLE);
  if (dto.reason === 'already_reviewed' && own !== undefined) {
    return { kind: 'can-change', own };
  }

  return { kind: 'blocked', reason: dto.reason ?? 'not_purchased' };
}

@Injectable({ providedIn: 'root' })
export class PacksApiService {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(STUB_ORIGIN);

  /**
   * `GET /packs?q=&sort=&limit=&cursor=`.
   *
   * The cursor is passed straight back the way it arrived. Page 3 calls it
   * opaque, and it stops being valid the moment q or sort change — which is
   * also why the catalogue store drops it on exactly that event.
   */
  packs(query: CatalogueQuery, cursor: string | null): Observable<PackPage> {
    let params = new HttpParams().set('sort', query.sort).set('limit', PAGE_LIMIT);
    if (query.q !== '') params = params.set('q', query.q);
    if (cursor !== null) params = params.set('cursor', cursor);

    return this.http
      .get<PacksPageDto>(`${this.origin}/packs`, { params })
      .pipe(map((dto) => ({ items: dto.items.map(toCard), nextCursor: dto.next_cursor })));
  }

  pack(id: string): Observable<Pack> {
    return this.http.get<PackDetailDto>(`${this.origin}/packs/${id}`).pipe(
      map((dto) => ({
        ...toCard(dto),
        description: dto.description,
        reviewCount: dto.review_count,
        distribution: toDistribution(dto.distribution),
      })),
    );
  }

  /** Unpaged, and it carries the permission the form needs to render once. */
  reviews(id: string): Observable<Reviews> {
    return this.http.get<ReviewsDto>(`${this.origin}/packs/${id}/reviews`).pipe(
      map((dto) => {
        const items = dto.items.map(toReview);
        return { items, permission: toPermission(dto, items) };
      }),
    );
  }

  /**
   * Page 3: "There is deliberately no idempotency key: RF7 is a promise about
   * what leaves the browser, not about what a server will tolerate." So there
   * is nothing to send here that would make a second POST safe — the guarantee
   * has to live in the form.
   */
  postReview(id: string, score: Score, body: string): Observable<RatingUpdate> {
    return this.http
      .post<PostReviewDto>(`${this.origin}/packs/${id}/reviews`, { score, body })
      .pipe(map((dto) => ({ rating: dto.rating, reviewCount: dto.review_count })));
  }

  /** RF3: the bytes, fetched with the header an `<img src>` cannot send. */
  media(mediaId: string): Observable<Blob> {
    return this.http.get(`${this.origin}/media/${mediaId}`, { responseType: 'blob' });
  }
}
