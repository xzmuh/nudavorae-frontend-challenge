# Decisions

**Cancelling the stale request (RF2).** One `switchMap` in `CatalogueStore`
carries every catalogue request; a newer search unsubscribes the previous HTTP
call, which aborts it. The old answer is never received, rather than received
and ignored. No debounce: it makes the race rarer, never impossible.

**Where the RF6 cache lives.** `CatalogueStore`, root-provided: cards, cursor,
scroll offset. `load()` returns early for the `q`/`sort` pair it holds, so back
renders from memory with no request and no spinner. Invalidated by whatever
invalidates the cursor: `q` or `sort` changing. The offset is read on
`NavigationStart`, not in a destroy hook — those run after the view is detached,
when `scrollY` is already clamped to zero. Covers are not cached: an object URL
outliving its component is an auto-fail, and `/media` sends `max-age=300`.

**At fifty thousand packs.** The wire scales; the DOM does not. Windowise with
`@angular/cdk/scrolling`, swap the button for an observed sentinel, and hold a
sliding window of pages so a back-restore replays two rather than all. Debounce
at the edge — on top of cancellation, never instead.

**Assumptions.** The contract has no `own_review_id`, so the caller's own review
is the one the stub attributes to `you`; `already_reviewed` reads as a refusal
while no such review is in the list — every seeded pack — and as "change your
review" once you have posted one. Typing replaces the history entry, a sort
pushes one: a sort is a decision, a keystroke is not. `rating` stays a string to
the screen, because reparsing reintroduces the drift the contract removed;
`null` is "not rated", never 0. Levers are read from `location.search`, not the
Router, so they are not application state and adding one to a loaded screen
refetches nothing. The optimistic average comes from the distribution, never
from an already-rounded one. `system` is the absence of a choice, not a third
theme. `--surface-raised` is white, and `--brand-ground` does not lift in dark:
the palette gives one light surface, and brand as ink and brand as ground want
opposite things. `pack_removed` packs stay listed.

**Not done.** No virtualisation; see above. No runtime schema validation.
Changing a published review is offered where the contract implies it; the
stub's `409` lands in RF5's rollback. Verified in Chromium only — Firefox and
Safari unopened — and the accessibility tree stood in for a real screen reader.
One fix to `scripts/dev.mjs`, named in the README.
