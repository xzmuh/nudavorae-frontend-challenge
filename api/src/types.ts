export type Currency = 'USD';

export type ServiceLevel = 'new' | 'rising' | 'top' | 'elite';

export interface Seller {
  id: string;
  name: string;
  handle: string;
  avatarImageId: string;
  verified: boolean;
  followers: number;
  level: ServiceLevel;
  country: string;
}

export interface Service {
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
  ratingSum: number;
  ratingCount: number;
  seller: Seller;
  coverImageId: string;
  galleryImageIds: string[];
  createdAt: string;
}

/** Shape sent over the wire for a card in the catalog list. */
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
  seller: Pick<Seller, 'id' | 'name' | 'handle' | 'avatarImageId' | 'verified' | 'level'>;
}

export interface ServiceDetail extends Omit<Service, 'ratingSum'> {
  ratingAvg: number;
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

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export type SortKey =
  | 'relevance'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'rating_desc'
  | 'reviews_desc';

export interface CategoryFacet {
  id: string;
  label: string;
  count: number;
}

export interface CatalogMeta {
  categories: CategoryFacet[];
  priceRange: { minCents: number; maxCents: number };
  sorts: { id: SortKey; label: string }[];
  total: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
