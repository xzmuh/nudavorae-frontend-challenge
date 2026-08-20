import { CATEGORIES, services } from './data.ts';
import type { Service, ServiceListItem, SortKey } from './types.ts';

export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'relevance', label: 'Most relevant' },
  { id: 'newest', label: 'Newest first' },
  { id: 'price_asc', label: 'Price: low to high' },
  { id: 'price_desc', label: 'Price: high to low' },
  { id: 'rating_desc', label: 'Best rated' },
  { id: 'reviews_desc', label: 'Most reviewed' },
];

const CATEGORY_LABELS = new Map<string, string>(CATEGORIES.map((c) => [c.id, c.label]));

export interface CatalogQuery {
  q: string;
  sort: SortKey;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  categories: string[];
  page: number;
  pageSize: number;
}

export function isSortKey(value: string): value is SortKey {
  return SORTS.some((sort) => sort.id === value);
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const rawSort = params.get('sort') ?? '';
  const rawMin = Number(params.get('minPrice'));
  const rawMax = Number(params.get('maxPrice'));
  const rawPage = Number(params.get('page'));
  const rawPageSize = Number(params.get('pageSize'));

  return {
    q: (params.get('q') ?? '').trim(),
    sort: isSortKey(rawSort) ? rawSort : 'relevance',
    minPriceCents: Number.isFinite(rawMin) && params.get('minPrice') !== null ? Math.max(0, Math.round(rawMin * 100)) : null,
    maxPriceCents: Number.isFinite(rawMax) && params.get('maxPrice') !== null ? Math.max(0, Math.round(rawMax * 100)) : null,
    categories: (params.get('category') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && CATEGORY_LABELS.has(value)),
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.trunc(rawPage) : 1,
    // The upper bound covers a reload that has to restore several already
    // paginated pages in a single request.
    pageSize: Number.isFinite(rawPageSize) ? Math.min(240, Math.max(1, Math.trunc(rawPageSize))) : 24,
  };
}

function haystack(service: Service): string {
  return normalize(
    [
      service.title,
      service.summary,
      CATEGORY_LABELS.get(service.category) ?? service.category,
      service.tags.join(' '),
      service.seller.name,
      service.seller.handle,
    ].join('  '),
  );
}

const haystackCache = new Map<string, string>();

function cachedHaystack(service: Service): string {
  const cached = haystackCache.get(service.id);
  if (cached !== undefined) return cached;
  const value = haystack(service);
  haystackCache.set(service.id, value);
  return value;
}

function relevanceScore(service: Service, tokens: string[]): number {
  const title = normalize(service.title);
  const text = cachedHaystack(service);
  let score = 0;

  for (const token of tokens) {
    if (!text.includes(token)) return -1;
    if (title.startsWith(token)) score += 120;
    else if (new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(title)) score += 90;
    else if (title.includes(token)) score += 55;
    else if (normalize(service.tags.join(' ')).includes(token)) score += 35;
    else score += 12;
  }

  const average = service.ratingCount > 0 ? service.ratingSum / service.ratingCount : 0;
  return score + average * 4 + Math.log10(service.ratingCount + 1) * 6;
}

function compare(a: Service, b: Service, sort: SortKey, scores: Map<string, number>): number {
  switch (sort) {
    case 'newest':
      return b.createdAt.localeCompare(a.createdAt);
    case 'price_asc':
      return a.priceCents - b.priceCents || a.id.localeCompare(b.id);
    case 'price_desc':
      return b.priceCents - a.priceCents || a.id.localeCompare(b.id);
    case 'rating_desc': {
      const avgA = a.ratingCount > 0 ? a.ratingSum / a.ratingCount : 0;
      const avgB = b.ratingCount > 0 ? b.ratingSum / b.ratingCount : 0;
      return avgB - avgA || b.ratingCount - a.ratingCount || a.id.localeCompare(b.id);
    }
    case 'reviews_desc':
      return b.ratingCount - a.ratingCount || a.id.localeCompare(b.id);
    case 'relevance':
    default: {
      const scoreA = scores.get(a.id) ?? 0;
      const scoreB = scores.get(b.id) ?? 0;
      return scoreB - scoreA || a.id.localeCompare(b.id);
    }
  }
}

export function toListItem(service: Service): ServiceListItem {
  return {
    id: service.id,
    slug: service.slug,
    title: service.title,
    summary: service.summary,
    category: service.category,
    tags: service.tags,
    priceCents: service.priceCents,
    currency: service.currency,
    deliveryDays: service.deliveryDays,
    filesCount: service.filesCount,
    ratingAvg: service.ratingCount > 0 ? service.ratingSum / service.ratingCount : 0,
    ratingCount: service.ratingCount,
    coverImageId: service.coverImageId,
    createdAt: service.createdAt,
    seller: {
      id: service.seller.id,
      name: service.seller.name,
      handle: service.seller.handle,
      avatarImageId: service.seller.avatarImageId,
      verified: service.seller.verified,
      level: service.seller.level,
    },
  };
}

export interface CatalogResult {
  items: ServiceListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export function searchCatalog(query: CatalogQuery): CatalogResult {
  const tokens = normalize(query.q).split(/\s+/).filter((token) => token.length > 0);
  const scores = new Map<string, number>();
  const matched: Service[] = [];

  for (const service of services) {
    if (query.categories.length > 0 && !query.categories.includes(service.category)) continue;
    if (query.minPriceCents !== null && service.priceCents < query.minPriceCents) continue;
    if (query.maxPriceCents !== null && service.priceCents > query.maxPriceCents) continue;

    if (tokens.length > 0) {
      const score = relevanceScore(service, tokens);
      if (score < 0) continue;
      scores.set(service.id, score);
    }
    matched.push(service);
  }

  matched.sort((a, b) => compare(a, b, query.sort, scores));

  const total = matched.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  const items = matched.slice(start, start + query.pageSize).map(toListItem);

  return {
    items,
    total,
    page,
    pageSize: query.pageSize,
    totalPages,
    hasMore: start + items.length < total,
  };
}

export function categoryFacets(): { id: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const service of services) {
    counts.set(service.category, (counts.get(service.category) ?? 0) + 1);
  }
  return CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    count: counts.get(category.id) ?? 0,
  }));
}
