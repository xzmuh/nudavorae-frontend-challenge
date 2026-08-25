import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { type ApiError, toApiError } from '../api/api-error';
import type { PackCard, PackPage, SortKey } from '../api/models';
import { type CatalogueQuery, PacksApiService } from '../api/packs-api.service';

export const DEFAULT_QUERY: CatalogueQuery = { q: '', sort: 'newest' };

export type CatalogueStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

/**
 * The identity of a result set. Page 3: a cursor "stops being valid the moment
 * q or sort changes" — so the same two fields that invalidate the cursor are
 * the ones that invalidate this cache, and there is only one rule to remember.
 */
function keyOf(query: CatalogueQuery): string {
  return `${query.sort}\u0000${query.q}`;
}

interface CatalogueRequest {
  readonly key: string;
  readonly query: CatalogueQuery;
  readonly cursor: string | null;
  readonly mode: 'replace' | 'append';
}

interface CatalogueResult {
  readonly request: CatalogueRequest;
  readonly page: PackPage | null;
  readonly error: ApiError | null;
}

/**
 * The catalogue, for the whole session.
 *
 * Root-provided and holding signals, which page 5 asks for by name: "NgRx,
 * NGXS, Elf or another store library [...] A root-provided service holding
 * signals is not what we mean by that: RF6 requires exactly such a thing, and
 * we expect to see it."
 *
 * Two guarantees live here.
 *
 * RF2 — a late answer to an old question never lands. Every request goes
 * through one `switchMap`, which unsubscribes the previous HTTP call; Angular's
 * client aborts the underlying request on unsubscribe, so the stale answer is
 * not merely ignored, it is never received. There is no timer anywhere in this
 * file and no debounce on the input that feeds it: a debounce would make the
 * race rarer without making it impossible, and page 7 is explicit that "if the
 * fix is a delay, the bug is still there".
 *
 * Each result still carries the request that produced it, and `apply` drops any
 * whose key is no longer the loaded one. That is not a second race guard so
 * much as the thing that lets `append` know it is appending to the list it
 * asked for.
 *
 * RF6 — going back restores the list. The loaded cards, the cursor and the
 * scroll offset live in this singleton, so returning from a pack re-renders the
 * same items at the same position without a request. `load` returns early when
 * the key it is asked for is the key already on screen; that early return *is*
 * the cache, and the paragraph above is when it is invalidated.
 */
@Injectable({ providedIn: 'root' })
export class CatalogueStore {
  private readonly api = inject(PacksApiService);
  private readonly requests = new Subject<CatalogueRequest>();

  /** The key whose results are currently in `items`. */
  private loadedKey: string | null = null;
  private scrollOffset = 0;

  private readonly itemsSignal = signal<readonly PackCard[]>([]);
  private readonly statusSignal = signal<CatalogueStatus>('idle');
  private readonly errorSignal = signal<ApiError | null>(null);
  private readonly nextCursorSignal = signal<string | null>(null);
  private readonly loadingMoreSignal = signal(false);
  private readonly querySignal = signal<CatalogueQuery>(DEFAULT_QUERY);

  readonly items = this.itemsSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly loadingMore = this.loadingMoreSignal.asReadonly();
  /** The query the visible cards actually belong to. */
  readonly query = this.querySignal.asReadonly();
  readonly hasMore = computed(() => this.nextCursorSignal() !== null);

  /**
   * An empty catalogue and an empty search are different screens (page 2), and
   * the difference is knowable only from the query the results belong to.
   */
  readonly isSearching = computed(() => this.querySignal().q !== '');

  constructor() {
    this.requests
      .pipe(
        switchMap((request) =>
          this.api.packs(request.query, request.cursor).pipe(
            map((page): CatalogueResult => ({ request, page, error: null })),
            catchError((cause: unknown) =>
              of<CatalogueResult>({ request, page: null, error: toApiError(cause) }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.apply(result));
  }

  /**
   * Called on every change to the URL. Fetches only when the URL is asking for
   * something other than what is already loaded — which is what makes a back
   * navigation instant and spinner-free.
   */
  load(query: CatalogueQuery, options: { readonly force?: boolean } = {}): void {
    const key = keyOf(query);
    this.querySignal.set(query);

    const alreadyLoaded =
      key === this.loadedKey && this.itemsSignal().length > 0 && this.statusSignal() !== 'error';
    if (alreadyLoaded && options.force !== true) return;

    this.loadedKey = key;
    this.scrollOffset = 0;
    this.itemsSignal.set([]);
    this.nextCursorSignal.set(null);
    this.loadingMoreSignal.set(false);
    this.errorSignal.set(null);
    this.statusSignal.set('loading');

    this.requests.next({ key, query, cursor: null, mode: 'replace' });
  }

  /** Extends the list in place with the next cursor page. */
  loadMore(): void {
    const cursor = this.nextCursorSignal();
    if (cursor === null || this.loadingMoreSignal() || this.statusSignal() !== 'ready') return;

    const query = this.querySignal();
    this.loadingMoreSignal.set(true);
    this.errorSignal.set(null);
    this.requests.next({ key: keyOf(query), query, cursor, mode: 'append' });
  }

  retry(): void {
    this.load(this.querySignal(), { force: true });
  }

  rememberScroll(offset: number): void {
    this.scrollOffset = offset;
  }

  /** The offset to restore, or null when there is nothing cached to restore. */
  scrollToRestore(query: CatalogueQuery): number | null {
    if (keyOf(query) !== this.loadedKey || this.itemsSignal().length === 0) return null;
    return this.scrollOffset;
  }

  /**
   * RF5 writes the new average back into the card that is still in the list, so
   * a back navigation does not show a figure the pack screen already corrected.
   * A rollback on the pack screen calls this again with the old value.
   */
  patchRating(packId: string, rating: string | null): void {
    this.itemsSignal.update((items) =>
      items.map((item) => (item.id === packId ? { ...item, rating } : item)),
    );
  }

  private apply(result: CatalogueResult): void {
    // A result for a query that is no longer loaded is not ours to apply. With
    // switchMap in front this should be unreachable; keeping it means `append`
    // can never splice one query's page onto another query's list.
    if (result.request.key !== this.loadedKey) return;

    if (result.error !== null) {
      this.errorSignal.set(result.error);
      this.loadingMoreSignal.set(false);
      // A failed "load more" keeps the cards that are already on screen: the
      // list did not become wrong, it just did not grow.
      if (result.request.mode === 'replace') this.statusSignal.set('error');
      return;
    }

    const page = result.page;
    if (page === null) return;

    this.errorSignal.set(null);
    this.nextCursorSignal.set(page.nextCursor);

    if (result.request.mode === 'replace') {
      this.itemsSignal.set(page.items);
    } else {
      this.itemsSignal.update((items) => [...items, ...page.items]);
      this.loadingMoreSignal.set(false);
    }

    this.statusSignal.set(this.itemsSignal().length === 0 ? 'empty' : 'ready');
  }
}

export type { CatalogueQuery, SortKey };
