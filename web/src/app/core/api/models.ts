export type Currency = 'USD';

export type SellerLevel = 'new' | 'rising' | 'top' | 'elite';

export type SortKey =
  | 'relevance'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'rating_desc'
  | 'reviews_desc';

export interface SellerSummary {
  id: string;
  name: string;
  handle: string;
  avatarImageId: string;
  verified: boolean;
  level: SellerLevel;
}

export interface Seller extends SellerSummary {
  followers: number;
  country: string;
}

export interface ServiceListItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  priceCents: number;
  currency: Currency;
  deliveryDays: number;
  filesCount: number;
  ratingAvg: number;
  ratingCount: number;
  coverImageId: string;
  createdAt: string;
  seller: SellerSummary;
}

export interface ServiceDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
  priceCents: number;
  currency: Currency;
  deliveryDays: number;
  filesCount: number;
  ratingAvg: number;
  ratingCount: number;
  seller: Seller;
  coverImageId: string;
  galleryImageIds: string[];
  createdAt: string;
}

export interface CatalogPage {
  items: ServiceListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  query: { q: string; sort: SortKey };
}

export interface ServiceDetailResponse {
  service: ServiceDetail;
  related: ServiceListItem[];
}

export interface Review {
  id: string;
  serviceId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarImageId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ReviewsPage {
  items: Review[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CreateReviewResponse {
  review: Review;
  ratingAvg: number;
  ratingCount: number;
}

export interface CategoryFacet {
  id: string;
  label: string;
  count: number;
}

export interface SortOption {
  id: SortKey;
  label: string;
}

export interface CatalogMeta {
  categories: CategoryFacet[];
  priceRange: { minCents: number; maxCents: number };
  sorts: SortOption[];
  total: number;
}

export type ChaosMatchMode = 'equals' | 'contains' | 'startsWith';

export interface ChaosRule {
  id: string;
  label: string;
  method: string | null;
  pathContains: string | null;
  queryMatch: Record<string, string>;
  matchMode: ChaosMatchMode;
  delayMs: number;
  status: number | null;
  message: string | null;
  remaining: number | null;
  hits: number;
  createdAt: string;
}

export interface ChaosRuleInput {
  label: string;
  method?: string;
  pathContains?: string;
  queryMatch?: Record<string, string>;
  matchMode?: ChaosMatchMode;
  delayMs?: number;
  status?: number;
  times?: number;
}
