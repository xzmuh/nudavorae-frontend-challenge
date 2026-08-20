import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap, map } from 'rxjs';
import { ApiError, asApiError } from '../api/api-error';
import { CatalogApiService, PAGE_SIZE } from '../api/catalog-api.service';
import type { CatalogPage, ServiceListItem } from '../api/models';
import { type CatalogFilters, DEFAULT_FILTERS, filtersKey } from './catalog-filters';

/** Upper bound for the pages a reload restores in a single request. */
export const MAX_RESTORE_PAGES = 10;

export type CatalogStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface CatalogRequest {
  token: number;
  key: string;
  filters: CatalogFilters;
  page: number;
  pageSize: number;
  /** How many catalog pages this single request stands for. */
  pages: number;
  mode: 'replace' | 'append';
}

interface CatalogResult {
  request: CatalogRequest;
  page: CatalogPage | null;
  error: ApiError | null;
}

/**
 * Holds the catalog list for the whole session.
 *
 * Two guarantees matter here:
 *
 * 1. **No stale search may win.** Requests flow through `switchMap`, which
 *    unsubscribes (and therefore aborts) the previous HTTP call, and every
 *    result also carries the token of the request that produced it -- a result
 *    whose token is not the newest one is dropped. Typing `sor` (slow) and then
 *    `sorvete` (fast) can never end with `sor` on screen. No timers involved.
 *
 * 2. **Going back restores the list.** The loaded pages, the filters key and
 *    the scroll offset stay in this singleton, so returning from a service
 *    detail re-renders the exact same items at the exact same position without
 *    a spinner and without refetching anything.
 */
@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private readonly api = inject(CatalogApiService);

  private readonly requests = new Subject<CatalogRequest>();
  private latestToken = 0;
  private currentKey: string | null = null;

  private readonly itemsSignal = signal<ServiceListItem[]>([]);
  private readonly statusSignal = signal<CatalogStatus>('idle');
  private readonly errorSignal = signal<ApiError | null>(null);
  private readonly loadingMoreSignal = signal(false);
  private readonly totalSignal = signal(0);
  private readonly pageSignal = signal(0);
  private readonly hasMoreSignal = signal(false);
  private readonly filtersSignal = signal<CatalogFilters>(DEFAULT_FILTERS);
  private readonly appliedQuerySignal = signal('');

  /** Scroll offset of the catalog page, remembered across navigations. */
  private scrollOffset = 0;

  readonly items = this.itemsSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly loadingMore = this.loadingMoreSignal.asReadonly();
  readonly total = this.totalSignal.asReadonly();
  readonly hasMore = this.hasMoreSignal.asReadonly();
  readonly filters = this.filtersSignal.asReadonly();
  /** Search term the visible results actually belong to. */
  readonly appliedQuery = this.appliedQuerySignal.asReadonly();
  readonly loadedCount = computed(() => this.itemsSignal().length);
  /** Pages currently on screen; mirrored in the URL as `pages`. */
  readonly pagesLoaded = this.pageSignal.asReadonly();

  constructor() {
    this.requests
      .pipe(
        switchMap((request) =>
          this.api.search(request.filters, request.page, request.pageSize).pipe(
            map((page): CatalogResult => ({ request, page, error: null })),
            catchError((error: unknown) =>
              of<CatalogResult>({ request, page: null, error: asApiError(error) }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.apply(result));
  }

  /**
   * Entry point used by the catalog page whenever the URL changes.
   * If the requested filters are the ones already loaded, nothing is fetched --
   * that is what makes the back navigation instant.
   */
  load(filters: CatalogFilters, options: { force?: boolean; pages?: number } = {}): void {
    const key = filtersKey(filters);
    this.filtersSignal.set(filters);

    const alreadyLoaded =
      key === this.currentKey && this.itemsSignal().length > 0 && this.statusSignal() !== 'error';

    if (alreadyLoaded && options.force !== true) return;

    // A reload of ".../?q=design&pages=4" rebuilds the four pages that were on
    // screen with one request, instead of dropping the visitor back to page 1.
    const pages = Math.max(1, Math.min(MAX_RESTORE_PAGES, options.pages ?? 1));

    this.currentKey = key;
    this.scrollOffset = 0;
    this.itemsSignal.set([]);
    this.totalSignal.set(0);
    this.hasMoreSignal.set(false);
    this.pageSignal.set(0);
    this.errorSignal.set(null);
    this.statusSignal.set('loading');
    this.dispatch({ filters, page: 1, pageSize: pages * PAGE_SIZE, pages, mode: 'replace', key });
  }

  loadMore(): void {
    if (this.loadingMoreSignal() || !this.hasMoreSignal() || this.statusSignal() !== 'ready') return;
    const filters = this.filtersSignal();
    this.loadingMoreSignal.set(true);
    this.dispatch({
      filters,
      page: this.pageSignal() + 1,
      pageSize: PAGE_SIZE,
      pages: 1,
      mode: 'append',
      key: filtersKey(filters),
    });
  }

  retry(): void {
    this.load(this.filtersSignal(), { force: true });
  }

  rememberScroll(offset: number): void {
    this.scrollOffset = offset;
  }

  /** Offset to restore, or `null` when there is nothing cached to restore. */
  takeScrollOffset(filters: CatalogFilters): number | null {
    if (filtersKey(filters) !== this.currentKey) return null;
    if (this.itemsSignal().length === 0) return null;
    return this.scrollOffset;
  }

  /** Keeps the card in the list in sync after a review changes the average. */
  patchItem(serviceId: string, patch: Partial<ServiceListItem>): void {
    this.itemsSignal.update((items) =>
      items.map((item) => (item.id === serviceId ? { ...item, ...patch } : item)),
    );
  }

  private dispatch(request: Omit<CatalogRequest, 'token'>): void {
    this.latestToken += 1;
    this.requests.next({ ...request, token: this.latestToken });
  }

  private apply(result: CatalogResult): void {
    // Second guard: even if an older response somehow reaches this point, its
    // token is behind the newest request and the result is discarded.
    if (result.request.token !== this.latestToken) return;

    if (result.error !== null) {
      this.loadingMoreSignal.set(false);
      if (result.request.mode === 'replace') {
        this.errorSignal.set(result.error);
        this.statusSignal.set('error');
      } else {
        // A failed "load more" keeps the list on screen and surfaces the error.
        this.errorSignal.set(result.error);
      }
      return;
    }

    const page = result.page;
    if (page === null) return;

    this.errorSignal.set(null);
    this.pageSignal.set(
      result.request.mode === 'replace' ? result.request.pages : result.request.page,
    );
    this.totalSignal.set(page.total);
    this.hasMoreSignal.set(page.hasMore);
    this.appliedQuerySignal.set(page.query.q);

    if (result.request.mode === 'replace') {
      this.itemsSignal.set(page.items);
    } else {
      const seen = new Set(this.itemsSignal().map((item) => item.id));
      this.itemsSignal.update((items) => [
        ...items,
        ...page.items.filter((item) => !seen.has(item.id)),
      ]);
      this.loadingMoreSignal.set(false);
    }

    this.statusSignal.set(this.itemsSignal().length === 0 ? 'empty' : 'ready');
  }
}
