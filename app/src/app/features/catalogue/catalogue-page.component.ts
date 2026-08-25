import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { type SortKey, isSortKey } from '../../core/api/contract';
import { CatalogueStore } from '../../core/catalogue/catalogue-store';
import { PackCardComponent } from '../../ui/pack-card.component';
import { StatePanelComponent } from '../../ui/state-panel.component';

const SORT_LABELS: ReadonlyArray<{ readonly value: SortKey; readonly label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Highest rated' },
];

@Component({
  selector: 'nud-catalogue-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PackCardComponent, StatePanelComponent],
  templateUrl: './catalogue-page.component.html',
  styleUrl: './catalogue-page.component.css',
})
export class CataloguePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly document = inject(DOCUMENT);
  private readonly view = this.document.defaultView;

  protected readonly store = inject(CatalogueStore);
  protected readonly sortOptions = SORT_LABELS;

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');

  /**
   * RF1 — "The URL is the state. Query and sort live in it, so reload
   * reproduces what was on screen and a pasted link opens the same results for
   * someone else."
   *
   * Read as two string signals rather than one object, so that a change to a
   * parameter this screen does not own — the `delay`, `fail` and `empty` levers
   * live in the same URL — recomputes to the same value and notifies nobody.
   * That is what lets a reviewer add `&fail=500` to a loaded screen without the
   * screen refetching itself.
   */
  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  protected readonly q = computed(() => this.params().get('q') ?? '');
  protected readonly sort = computed<SortKey>(() => {
    const raw = this.params().get('sort');
    return isSortKey(raw) ? raw : 'newest';
  });

  protected readonly headingCount = computed(() => {
    const count = this.store.items().length;
    return `${count} ${count === 1 ? 'pack' : 'packs'}`;
  });

  /** Placeholders for the first load only; "load more" keeps the real cards. */
  protected readonly skeletons = [0, 1, 2, 3, 4, 5, 6, 7];

  constructor() {
    // The URL asks; the store decides whether that means a request. Loading the
    // same q and sort it already holds is the early return that makes a back
    // navigation instant (RF6).
    effect(() => {
      this.store.load({ q: this.q(), sort: this.sort() });
    });

    // The field is uncontrolled while it has focus: navigation is async, and
    // rebinding its value from the URL mid-keystroke would make fast typing
    // stutter backwards. Anything that changes `q` from outside — a pasted
    // link, a back navigation, the empty state's "clear search" — still lands.
    effect(() => {
      const q = this.q();
      const element = this.searchInput()?.nativeElement;
      if (element === undefined || element.value === q) return;
      if (this.document.activeElement === element) return;
      element.value = q;
    });

    // RF4 — "the three states are announced when they replace one another, not
    // only drawn".
    let announced: string | null = null;
    effect(() => {
      const message = this.statusMessage();
      if (message === null || message === announced) return;
      announced = message;
      this.announcer.announce(message, 'polite');
    });

    // RF6 — same scroll position, and no flash of a spinner on the way back.
    afterNextRender(() => {
      const offset = this.store.scrollToRestore({ q: this.q(), sort: this.sort() });
      if (offset !== null && offset > 0) this.view?.scrollTo({ top: offset, behavior: 'instant' });
    });

    // The offset has to be read while the list is still on screen, which is why
    // this is a router event and not a `DestroyRef` hook. A destroy hook runs
    // after Angular has detached the view: by then the document has collapsed
    // to the height of the next screen, the browser has clamped `scrollY` to
    // zero, and what gets remembered is zero. `NavigationStart` fires before
    // any of that, with the grid still mounted at its full height.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.store.rememberScroll(this.view?.scrollY ?? 0));
  }

  /** RF1: typing replaces the entry, so one search is one history step. */
  protected onSearch(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: value === '' ? null : value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Choosing a sort is a deliberate act rather than a keystroke, so it does
   * push an entry: back undoes the sort, which is what a user expects of it.
   */
  protected onSort(value: string): void {
    if (!isSortKey(value)) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: value === 'newest' ? null : value },
      queryParamsHandling: 'merge',
    });
  }

  protected clearSearch(): void {
    this.onSearch('');
    this.searchInput()?.nativeElement.focus();
  }

  private statusMessage(): string | null {
    const status = this.store.status();
    const q = this.store.query().q;

    switch (status) {
      case 'loading':
        return q === '' ? 'Loading packs.' : `Searching packs for ${q}.`;
      case 'ready':
        return `${this.headingCount()} found${q === '' ? '' : ` for ${q}`}.`;
      case 'empty':
        return q === '' ? 'The catalogue is empty.' : `No packs match ${q}.`;
      case 'error':
        return `Packs could not be loaded. ${this.store.error()?.message ?? ''}`.trim();
      default:
        return null;
    }
  }
}
