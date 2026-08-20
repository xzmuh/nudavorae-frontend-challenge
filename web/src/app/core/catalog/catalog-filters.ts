import type { ParamMap } from '@angular/router';
import type { SortKey } from '../api/models';

export interface CatalogFilters {
  q: string;
  sort: SortKey;
  /** Whole dollars, as they appear in the URL. `null` means "no bound". */
  minPrice: number | null;
  maxPrice: number | null;
  categories: string[];
}

export const SORT_KEYS: readonly SortKey[] = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'rating_desc',
  'reviews_desc',
];

export const DEFAULT_FILTERS: CatalogFilters = {
  q: '',
  sort: 'relevance',
  minPrice: null,
  maxPrice: null,
  categories: [],
};

function isSortKey(value: string | null): value is SortKey {
  return value !== null && SORT_KEYS.includes(value as SortKey);
}

function readNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

/** URL -> state. The URL is the single source of truth for search/sort/price. */
export function parseFilters(params: ParamMap): CatalogFilters {
  const q = params.get('q') ?? '';
  const sort = params.get('sort');
  const min = params.get('minPrice');
  const max = params.get('maxPrice');
  const category = params.get('category') ?? '';

  return {
    q,
    sort: isSortKey(sort) ? sort : DEFAULT_FILTERS.sort,
    minPrice: readNumber(min),
    maxPrice: readNumber(max),
    categories: category
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  };
}

/** State -> URL. Defaults are omitted so shared links stay readable. */
export function toQueryParams(filters: CatalogFilters): Record<string, string | null> {
  return {
    q: filters.q.trim() === '' ? null : filters.q,
    sort: filters.sort === DEFAULT_FILTERS.sort ? null : filters.sort,
    minPrice: filters.minPrice === null ? null : String(filters.minPrice),
    maxPrice: filters.maxPrice === null ? null : String(filters.maxPrice),
    category: filters.categories.length === 0 ? null : filters.categories.join(','),
  };
}

/** Stable identity of a result set -- used as the cache key of the list. */
export function filtersKey(filters: CatalogFilters): string {
  return JSON.stringify({
    q: filters.q.trim().toLowerCase(),
    sort: filters.sort,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    categories: [...filters.categories].sort(),
  });
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return filtersKey(filters) !== filtersKey(DEFAULT_FILTERS);
}
