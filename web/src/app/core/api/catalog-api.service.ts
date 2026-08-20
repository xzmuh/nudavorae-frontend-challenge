import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, shareReplay } from 'rxjs';
import type { CatalogFilters } from '../catalog/catalog-filters';
import { API_BASE_URL } from './api.config';
import type {
  CatalogMeta,
  CatalogPage,
  CreateReviewResponse,
  ReviewsPage,
  ServiceDetailResponse,
} from './models';

export const PAGE_SIZE = 24;

export interface CreateReviewInput {
  rating: number;
  comment: string;
}

@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Facets barely change, so the single request is shared by every caller. */
  private readonly meta$ = this.http
    .get<CatalogMeta>(`${this.baseUrl}/api/meta`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  meta(): Observable<CatalogMeta> {
    return this.meta$;
  }

  search(filters: CatalogFilters, page: number, pageSize: number = PAGE_SIZE): Observable<CatalogPage> {
    let params = new HttpParams()
      .set('sort', filters.sort)
      .set('page', String(page))
      .set('pageSize', String(pageSize));

    if (filters.q.trim() !== '') params = params.set('q', filters.q.trim());
    if (filters.minPrice !== null) params = params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice !== null) params = params.set('maxPrice', String(filters.maxPrice));
    if (filters.categories.length > 0) params = params.set('category', filters.categories.join(','));

    return this.http.get<CatalogPage>(`${this.baseUrl}/api/services`, { params });
  }

  detail(serviceId: string): Observable<ServiceDetailResponse> {
    return this.http.get<ServiceDetailResponse>(
      `${this.baseUrl}/api/services/${encodeURIComponent(serviceId)}`,
    );
  }

  reviews(serviceId: string, page: number, pageSize = 5): Observable<ReviewsPage> {
    const params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    return this.http.get<ReviewsPage>(
      `${this.baseUrl}/api/services/${encodeURIComponent(serviceId)}/reviews`,
      { params },
    );
  }

  createReview(serviceId: string, input: CreateReviewInput): Observable<CreateReviewResponse> {
    return this.http.post<CreateReviewResponse>(
      `${this.baseUrl}/api/services/${encodeURIComponent(serviceId)}/reviews`,
      { rating: input.rating, comment: input.comment, authorName: 'You' },
    );
  }

  /** Private media: goes through HttpClient so the interceptor can sign it. */
  image(imageId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/api/images/${encodeURIComponent(imageId)}`, {
      responseType: 'blob',
    });
  }
}
