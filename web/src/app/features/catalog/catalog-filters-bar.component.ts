import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { CatalogMeta, SortKey, SortOption } from '../../core/api/models';
import type { CatalogFilters } from '../../core/catalog/catalog-filters';
import {
  SelectMenuComponent,
  type SelectMenuOption,
} from '../../shared/select-menu/select-menu.component';

const FALLBACK_SORTS: SortOption[] = [
  { id: 'relevance', label: 'Most relevant' },
  { id: 'newest', label: 'Newest first' },
  { id: 'price_asc', label: 'Price: low to high' },
  { id: 'price_desc', label: 'Price: high to low' },
  { id: 'rating_desc', label: 'Best rated' },
  { id: 'reviews_desc', label: 'Most reviewed' },
];

interface FilterChip {
  id: string;
  label: string;
  kind: 'price' | 'category';
  value: string;
}

@Component({
  selector: 'app-catalog-filters-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, SelectMenuComponent],
  template: `
    <form class="bar" role="search" (submit)="$event.preventDefault()">
      <div class="row">
        <div class="search">
          <svg class="search__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M10.5 3a7.5 7.5 0 1 1-4.6 13.4l-3.2 3.2-1.4-1.4 3.2-3.2A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
              fill="currentColor"
            />
          </svg>
          <label class="visually-hidden" for="catalog-search">Search services</label>
          <input
            id="catalog-search"
            class="input search__input"
            type="search"
            autocomplete="off"
            placeholder="Search services, skills or sellers"
            [value]="term()"
            (input)="onSearchInput($event)"
          />
          @if (term() !== '') {
            <button
              type="button"
              class="search__clear"
              (click)="clearSearch()"
              aria-label="Clear search"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          }
        </div>

        <app-select-menu
          class="sort"
          [options]="sortOptions()"
          [value]="filters().sort"
          (valueChange)="onSortChange($event)"
          ariaLabel="Sort results"
          leading="Sort:"
        />

        <button
          type="button"
          class="btn btn--outline toggle"
          [class.toggle--on]="panelOpen()"
          [attr.aria-expanded]="panelOpen()"
          aria-controls="catalog-filters-panel"
          (click)="togglePanel()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 5h18v2.2l-7 6.6V21l-4-2.2v-5l-7-6.6V5Zm2.7 2 6.3 6v4.3l0 .1V13l6.3-6H5.7Z"
              fill="currentColor"
            />
          </svg>
          <span>{{ panelOpen() ? 'Hide filters' : 'Filters' }}</span>
          @if (activeCount() > 0) {
            <span class="toggle__badge">{{ activeCount() }}</span>
          }
        </button>
      </div>

      @if (chips().length > 0 || canReset()) {
        <ul class="active" aria-label="Active filters">
          @for (chip of chips(); track chip.id) {
            <li>
              <button
                type="button"
                class="chip chip--accent active__chip"
                [attr.aria-label]="'Remove filter ' + chip.label"
                (click)="removeChip(chip)"
              >
                {{ chip.label }}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </li>
          }
          <li>
            <button type="button" class="btn btn--ghost btn--sm" (click)="reset.emit()">
              Clear all
            </button>
          </li>
        </ul>
      }

      @if (panelOpen()) {
        <div class="panel" id="catalog-filters-panel">
          <fieldset class="price">
            <legend class="eyebrow">Price range</legend>
            <div class="price__inputs">
              <label class="visually-hidden" for="price-min">Minimum price</label>
              <input
                id="price-min"
                class="input input--price"
                type="number"
                inputmode="numeric"
                [min]="bounds().min"
                [max]="bounds().max"
                [value]="filters().minPrice ?? ''"
                [placeholder]="bounds().min | currency: 'USD' : 'symbol' : '1.0-0'"
                (change)="onPriceChange('min', $event)"
              />
              <span class="price__dash" aria-hidden="true">—</span>
              <label class="visually-hidden" for="price-max">Maximum price</label>
              <input
                id="price-max"
                class="input input--price"
                type="number"
                inputmode="numeric"
                [min]="bounds().min"
                [max]="bounds().max"
                [value]="filters().maxPrice ?? ''"
                [placeholder]="bounds().max | currency: 'USD' : 'symbol' : '1.0-0'"
                (change)="onPriceChange('max', $event)"
              />
            </div>

            <div
              class="slider"
              [style.--fill-start]="fillStart() + '%'"
              [style.--fill-end]="fillEnd() + '%'"
            >
              <label class="visually-hidden" for="price-slider-min">Minimum price slider</label>
              <input
                id="price-slider-min"
                class="slider__input"
                type="range"
                [min]="bounds().min"
                [max]="bounds().max"
                [step]="bounds().step"
                [value]="filters().minPrice ?? bounds().min"
                (change)="onSliderChange('min', $event)"
              />
              <label class="visually-hidden" for="price-slider-max">Maximum price slider</label>
              <input
                id="price-slider-max"
                class="slider__input"
                type="range"
                [min]="bounds().min"
                [max]="bounds().max"
                [step]="bounds().step"
                [value]="filters().maxPrice ?? bounds().max"
                (change)="onSliderChange('max', $event)"
              />
            </div>
          </fieldset>

          <div class="categories">
            <span class="eyebrow" id="categories-label">Categories</span>
            <div class="categories__list" role="group" aria-labelledby="categories-label">
              @for (category of categories(); track category.id) {
                <button
                  type="button"
                  class="chip category"
                  [class.category--on]="isSelected(category.id)"
                  [attr.aria-pressed]="isSelected(category.id)"
                  (click)="toggleCategory(category.id)"
                >
                  {{ category.label }}
                  <span class="category__count">{{ category.count }}</span>
                </button>
              }
            </div>
          </div>
        </div>
      }
    </form>
  `,
  styles: `
    .bar {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--color-surface);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-xl);
    }

    .row {
      display: flex;
      gap: var(--space-3);
      align-items: center;
    }

    .search {
      position: relative;
      flex: 1;
      min-width: 0;
    }

    .search__icon {
      position: absolute;
      left: var(--space-4);
      top: 50%;
      width: 16px;
      height: 16px;
      transform: translateY(-50%);
      color: var(--color-text-subtle);
      pointer-events: none;
    }

    .search__input {
      padding-left: var(--space-9);
      padding-right: var(--space-8);
      min-height: 44px;
    }

    .search__input::-webkit-search-cancel-button {
      display: none;
    }

    .search__clear {
      position: absolute;
      right: var(--space-2);
      top: 50%;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      transform: translateY(-50%);
      border: none;
      border-radius: var(--radius-pill);
      background: transparent;
      color: var(--color-text-subtle);
    }

    .search__clear:hover {
      background: var(--color-surface-hover);
      color: var(--color-text);
    }

    .search__clear svg {
      width: 14px;
      height: 14px;
    }

    .sort {
      flex: none;
    }

    .toggle {
      flex: none;
      min-height: 44px;
    }

    .toggle svg {
      width: 16px;
      height: 16px;
    }

    .toggle--on {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }

    .toggle__badge {
      display: grid;
      place-items: center;
      min-width: 20px;
      height: 20px;
      padding-inline: var(--space-1);
      border-radius: var(--radius-pill);
      background: var(--color-accent);
      color: var(--color-on-accent);
      font-size: var(--text-2xs);
    }

    .active {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
    }

    .active__chip {
      cursor: pointer;
      border: none;
    }

    .active__chip svg {
      width: 12px;
      height: 12px;
    }

    .active__chip:hover {
      background: var(--color-accent-soft-hover);
    }

    .panel {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--space-6);
      padding-top: var(--space-4);
      border-top: var(--border-width) solid var(--color-border-subtle);
      animation: fade-in var(--duration-fast) var(--ease-out);
    }

    .price {
      display: grid;
      gap: var(--space-2);
      min-width: 250px;
      margin: 0;
      padding: 0;
      border: none;
    }

    .price__inputs {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .input--price {
      width: 108px;
      min-height: 36px;
      padding-inline: var(--space-3);
      border-radius: var(--radius-sm);
    }

    .price__dash {
      color: var(--color-text-subtle);
    }

    .slider {
      position: relative;
      height: 22px;
    }

    .slider::before,
    .slider::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 4px;
      transform: translateY(-50%);
      border-radius: var(--radius-pill);
    }

    .slider::before {
      background: var(--color-border-strong);
    }

    .slider::after {
      left: var(--fill-start, 0%);
      right: calc(100% - var(--fill-end, 100%));
      background: var(--color-accent);
    }

    .slider__input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 22px;
      margin: 0;
      appearance: none;
      background: transparent;
      pointer-events: none;
    }

    .slider__input::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: var(--radius-pill);
      background: var(--color-surface);
      border: 2px solid var(--color-accent);
      box-shadow: var(--shadow-sm);
      pointer-events: auto;
      cursor: grab;
    }

    .slider__input::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: var(--radius-pill);
      background: var(--color-surface);
      border: 2px solid var(--color-accent);
      pointer-events: auto;
      cursor: grab;
    }

    .slider__input:focus-visible::-webkit-slider-thumb {
      outline: var(--focus-ring-width) solid var(--color-accent);
      outline-offset: var(--focus-ring-offset);
    }

    .categories {
      display: grid;
      gap: var(--space-2);
      flex: 1;
      min-width: 240px;
    }

    .categories__list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .category {
      cursor: pointer;
      transition:
        background-color var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out),
        border-color var(--duration-fast) var(--ease-out);
    }

    .category:hover {
      border-color: var(--color-border-strong);
      color: var(--color-text);
    }

    .category--on {
      border-color: transparent;
      background: var(--color-accent-soft);
      color: var(--color-accent);
    }

    .category__count {
      color: var(--color-text-subtle);
      font-size: var(--text-2xs);
    }

    @media (max-width: 760px) {
      .row {
        flex-wrap: wrap;
      }

      .search {
        flex: 1 1 100%;
      }

      .sort {
        flex: 1 1 auto;
      }

      .toggle {
        flex: 1 1 auto;
      }

      .panel {
        gap: var(--space-5);
      }

      .price {
        min-width: 100%;
      }

      .input--price {
        flex: 1;
        width: auto;
      }
    }
  `,
})
export class CatalogFiltersBarComponent {
  readonly filters = input.required<CatalogFilters>();
  readonly meta = input<CatalogMeta | null>(null);
  readonly canReset = input<boolean>(false);

  readonly filtersChange = output<CatalogFilters>();
  readonly reset = output<void>();

  /** Local mirror of the search box so typing stays responsive. */
  readonly term = signal('');
  /** The price/category controls live behind this toggle. */
  readonly panelOpen = signal(false);

  constructor() {
    // Keeps the box in sync when the URL changes from the outside
    // (back/forward navigation, reset button, shared link).
    effect(() => {
      const incoming = this.filters().q;
      untracked(() => {
        if (incoming !== this.term()) this.term.set(incoming);
      });
    });
  }

  readonly sorts = computed<SortOption[]>(() => this.meta()?.sorts ?? FALLBACK_SORTS);
  readonly sortOptions = computed<SelectMenuOption[]>(() =>
    this.sorts().map((sort) => ({ id: sort.id, label: sort.label })),
  );
  readonly categories = computed(() => this.meta()?.categories ?? []);

  readonly bounds = computed(() => {
    const range = this.meta()?.priceRange;
    const min = range === undefined ? 0 : Math.floor(range.minCents / 100);
    const max = range === undefined ? 1500 : Math.ceil(range.maxCents / 100);
    return { min, max, step: 5 };
  });

  readonly fillStart = computed(() => this.percentOf(this.filters().minPrice ?? this.bounds().min));
  readonly fillEnd = computed(() => this.percentOf(this.filters().maxPrice ?? this.bounds().max));

  /** Removable summary of what is filtering the list right now. */
  readonly chips = computed<FilterChip[]>(() => {
    const filters = this.filters();
    const labels = new Map(this.categories().map((category) => [category.id, category.label]));
    const chips: FilterChip[] = [];

    if (filters.minPrice !== null || filters.maxPrice !== null) {
      const min = filters.minPrice === null ? this.bounds().min : filters.minPrice;
      const max = filters.maxPrice === null ? this.bounds().max : filters.maxPrice;
      chips.push({ id: 'price', kind: 'price', value: 'price', label: `$${min} – $${max}` });
    }

    for (const category of filters.categories) {
      chips.push({
        id: `category:${category}`,
        kind: 'category',
        value: category,
        label: labels.get(category) ?? category,
      });
    }

    return chips;
  });

  readonly activeCount = computed(() => this.chips().length);

  protected isSelected(categoryId: string): boolean {
    return this.filters().categories.includes(categoryId);
  }

  protected togglePanel(): void {
    this.panelOpen.update((open) => !open);
  }

  protected removeChip(chip: FilterChip): void {
    if (chip.kind === 'price') {
      this.emit({ minPrice: null, maxPrice: null });
      return;
    }
    this.toggleCategory(chip.value);
  }

  protected onSearchInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    this.term.set(input.value);
    this.emit({ q: input.value });
  }

  protected clearSearch(): void {
    this.term.set('');
    this.emit({ q: '' });
  }

  protected onSortChange(sort: string): void {
    const known = this.sorts().find((option) => option.id === sort);
    if (known === undefined) return;
    this.emit({ sort: known.id as SortKey });
  }

  protected onPriceChange(edge: 'min' | 'max', event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const parsed = input.value.trim() === '' ? null : Number(input.value);
    const value =
      parsed === null || !Number.isFinite(parsed) ? null : Math.max(0, Math.round(parsed));
    this.applyPrice(edge, value);
  }

  protected onSliderChange(edge: 'min' | 'max', event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const value = Number(input.value);
    const { min, max } = this.bounds();
    if (edge === 'min') this.applyPrice('min', value <= min ? null : value);
    else this.applyPrice('max', value >= max ? null : value);
  }

  protected toggleCategory(categoryId: string): void {
    const current = this.filters().categories;
    const next = current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId];
    this.emit({ categories: next });
  }

  private applyPrice(edge: 'min' | 'max', value: number | null): void {
    const current = this.filters();
    const min = edge === 'min' ? value : current.minPrice;
    const max = edge === 'max' ? value : current.maxPrice;

    // Keep the pair coherent instead of silently dropping the change.
    if (min !== null && max !== null && min > max) {
      this.emit(
        edge === 'min' ? { minPrice: min, maxPrice: min } : { minPrice: max, maxPrice: max },
      );
      return;
    }
    this.emit({ minPrice: min, maxPrice: max });
  }

  private percentOf(value: number): number {
    const { min, max } = this.bounds();
    if (max <= min) return 0;
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  }

  private emit(patch: Partial<CatalogFilters>): void {
    this.filtersChange.emit({ ...this.filters(), ...patch });
  }
}
