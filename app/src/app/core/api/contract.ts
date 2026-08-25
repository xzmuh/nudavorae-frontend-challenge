/**
 * The wire shapes exactly as page 3 of the brief prints them — snake_case,
 * `price_cents` as an integer, `rating` as a decimal string or null.
 *
 * Nothing outside `packs-api.service.ts` imports from this file. The service
 * maps these into the domain models in `models.ts`, so the shape of the
 * marketplace's JSON never reaches a component or a template.
 */

export const SORT_KEYS = ['newest', 'price_asc', 'price_desc', 'rating'] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export function isSortKey(value: string | null | undefined): value is SortKey {
  return value !== null && value !== undefined && (SORT_KEYS as readonly string[]).includes(value);
}

/** Page 3: "Absolute counts, all five keys, always present." */
export interface DistributionDto {
  readonly '1': number;
  readonly '2': number;
  readonly '3': number;
  readonly '4': number;
  readonly '5': number;
}

export interface PackListItemDto {
  readonly id: string;
  readonly title: string;
  /** Without the `@`: the stub sends `lumen_ash`, the screen writes it. */
  readonly creator_handle: string;
  readonly price_cents: number;
  readonly cover_media_id: string;
  /** Decimal string, or null when nobody has rated the pack. Never a number. */
  readonly rating: string | null;
  readonly review_count: number;
}

export interface PacksPageDto {
  readonly items: readonly PackListItemDto[];
  /** Opaque. Never parsed. Null at the end. */
  readonly next_cursor: string | null;
}

export interface PackDetailDto extends PackListItemDto {
  readonly description: string;
  readonly distribution: DistributionDto;
  readonly created_at: string;
}

export interface ReviewDto {
  readonly id: string;
  readonly author_handle: string;
  readonly score: number;
  readonly body: string;
  readonly created_at: string;
}

export type CannotReviewReason = 'not_purchased' | 'already_reviewed' | 'pack_removed';

/**
 * Page 3: "Permission rides along with the list because the screen needs both
 * to render once."
 */
export interface ReviewsDto {
  readonly items: readonly ReviewDto[];
  readonly can_review: boolean;
  readonly reason?: CannotReviewReason;
  /** The same two figures the detail route carries, recomputed by the stub. */
  readonly rating: string | null;
  readonly review_count: number;
}

/**
 * The author handle the stub writes on a review made from this browser. It is
 * the only way the contract identifies the caller's own review — there is no
 * viewer object and no `own_review_id` — so it is what tells "you already
 * reviewed this" apart from "here is the review you left".
 */
export const VIEWER_HANDLE = 'you';

export interface PostReviewDto {
  readonly rating: string | null;
  readonly review_count: number;
}

/** Page 3: the body of everything that is not a 2xx. RF5 needs that message. */
export interface ApiErrorDto {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}
