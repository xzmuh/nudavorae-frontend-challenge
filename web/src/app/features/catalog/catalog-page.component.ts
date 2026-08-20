import { DOCUMENT, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationStart, Router, convertToParamMap } from '@angular/router';
import { filter } from 'rxjs';
import { CatalogApiService } from '../../core/api/catalog-api.service';
import { CatalogStore, MAX_RESTORE_PAGES } from '../../core/catalog/catalog-store.service';
import {
  DEFAULT_FILTERS,
  type CatalogFilters,
  hasActiveFilters,
  parseFilters,
  toQueryParams,
} from '../../core/catalog/catalog-filters';
import { EmptyStateComponent } from '../../shared/states/empty-state.component';
import { ErrorStateComponent } from '../../shared/states/error-state.component';
import { ServiceCardSkeletonComponent } from '../../shared/service-card/service-card-skeleton.component';
import { ServiceCardComponent } from '../../shared/service-card/service-card.component';
import { CatalogFiltersBarComponent } from './catalog-filters-bar.component';

@Component({
  selector: 'app-catalog-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    CatalogFiltersBarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ServiceCardComponent,
    ServiceCardSkeletonComponent,
  ],
  templateUrl: './catalog-page.component.html',
  styleUrl: './catalog-page.component.css',
})
export class CatalogPageComponent {
  private readonly store = inject(CatalogStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(CatalogApiService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: convertToParamMap({}),
  });

  readonly filters = computed<CatalogFilters>(() => parseFilters(this.queryParams()));

  /** Pagination depth carried by the URL, so a reload rebuilds what was shown. */
  readonly pagesInUrl = computed<number>(() => {
    const raw = Number(this.queryParams().get('pages') ?? '1');
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, Math.min(MAX_RESTORE_PAGES, Math.trunc(raw)));
  });
  readonly canReset = computed(() => hasActiveFilters(this.filters()));

  readonly status = this.store.status;
  readonly items = this.store.items;
  readonly error = this.store.error;
  readonly total = this.store.total;
  readonly hasMore = this.store.hasMore;
  readonly loadingMore = this.store.loadingMore;
  readonly loadedCount = this.store.loadedCount;
  readonly appliedQuery = this.store.appliedQuery;

  readonly skeletons = Array.from({ length: 12 }, (_, index) => index);

  readonly meta = toSignal(this.api.meta(), { initialValue: null });

  readonly headline = computed(() => {
    const query = this.filters().q.trim();
    return query === '' ? 'Browse services' : `Results for “${query}”`;
  });

  constructor() {
    // The URL drives the data: any change to search, sort, price or category
    // ends up here. Coming back to identical filters is a no-op in the store,
    // which is what keeps the cached list on screen.
    effect(() => {
      const filters = this.filters();
      const pages = this.pagesInUrl();
      untracked(() => this.store.load(filters, { pages }));
    });

    // ...and the other way around: every time another page is appended, the URL
    // records the new depth (replaceUrl, so the history stays clean).
    effect(() => {
      const pages = this.store.pagesLoaded();
      untracked(() => {
        if (pages <= 1 || pages === this.pagesInUrl()) return;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { pages: String(pages) },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });

    const view = this.document.defaultView;

    // Restoring the offset of a list that came from the cache: the items are
    // already in the first rendered frame, so this lands with no flicker and
    // without waiting on any timer.
    afterNextRender(() => {
      if (view === null) return;
      const offset = this.store.takeScrollOffset(this.filters());
      if (offset !== null && offset > 0) view.scrollTo(0, offset);
    });

    // The offset is captured when the navigation starts -- reading it on
    // destroy is too late, because the list is detached from the DOM first and
    // the browser has already clamped the scroll back to the top by then.
    this.router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (view !== null) this.store.rememberScroll(view.scrollY);
      });

    // The sentinel only exists once the list is rendered, so the observer is
    // (re)attached by an effect reacting to the view query instead of being
    // wired once at first render.
    effect((onCleanup) => {
      const target = this.sentinel()?.nativeElement;
      if (target === undefined) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) this.store.loadMore();
        },
        { rootMargin: '600px 0px' },
      );
      observer.observe(target);
      onCleanup(() => observer.disconnect());
    });
  }

  protected onFiltersChange(filters: CatalogFilters): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...toQueryParams(filters), pages: null },
      queryParamsHandling: 'merge',
      // Typing must not flood the history stack, but the URL always reflects
      // exactly what is on screen, so a reload reproduces it.
      replaceUrl: true,
    });
  }

  protected resetFilters(): void {
    this.onFiltersChange({ ...DEFAULT_FILTERS });
  }

  protected retry(): void {
    this.store.retry();
  }

  protected loadMore(): void {
    this.store.loadMore();
  }

  /** Loading state of the "load more" action, exposed for the template. */
  protected readonly loadMoreLabel = computed(() =>
    this.loadingMore() ? 'Loading…' : 'Load more services',
  );
}
