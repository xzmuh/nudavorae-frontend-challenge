/**
 * What the rest of the app is allowed to know about a pack.
 *
 * `rating` stays a string all the way to the screen. Page 3 made it a string
 * "so that no float formatting drifts between the answer and the screen";
 * parsing it here and formatting it again in a pipe would reintroduce exactly
 * the drift the contract removed. It is only ever rendered, never arithmetic.
 *
 * `null` is not zero. A pack nobody has rated shows "Not rated yet", which is a
 * different thing from a pack rated 0.0 — and a pack cannot be rated 0.0.
 */

import type { CannotReviewReason, SortKey } from './contract';

export type { CannotReviewReason, SortKey };

export interface PackCard {
  readonly id: string;
  readonly title: string;
  readonly creatorHandle: string;
  readonly priceCents: number;
  readonly coverMediaId: string;
  readonly rating: string | null;
}

export interface Pack extends PackCard {
  readonly description: string;
  readonly reviewCount: number;
  readonly distribution: Distribution;
}

/** Score → absolute count. All five scores always present. */
export type Distribution = Readonly<Record<Score, number>>;

export type Score = 1 | 2 | 3 | 4 | 5;

export const SCORES: readonly Score[] = [1, 2, 3, 4, 5];

export interface PackPage {
  readonly items: readonly PackCard[];
  /** Opaque cursor for the next page, or null at the end. */
  readonly nextCursor: string | null;
}

export interface Review {
  readonly id: string;
  readonly authorHandle: string;
  readonly score: Score;
  readonly body: string;
  readonly createdAt: string;
}

/**
 * The three answers the pack screen has to be able to render, collapsed into
 * one value so a template cannot accidentally render two of them at once.
 */
export type ReviewPermission =
  | { readonly kind: 'can-write' }
  | { readonly kind: 'can-change'; readonly own: Review }
  | { readonly kind: 'blocked'; readonly reason: CannotReviewReason };

export interface Reviews {
  readonly items: readonly Review[];
  readonly permission: ReviewPermission;
}

export interface RatingUpdate {
  readonly rating: string | null;
  readonly reviewCount: number;
}

/** Page 3: 1999 is $19.99. No decimal crosses the wire; the front does this. */
export function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}

/**
 * The contract sends `lumen_ash`; page 6 prints `@lumen_ash`. The `@` is
 * presentation, so it is added once here rather than stored on the model or
 * repeated in three templates.
 */
export function formatHandle(handle: string): string {
  return handle.startsWith('@') ? handle : `@${handle}`;
}
