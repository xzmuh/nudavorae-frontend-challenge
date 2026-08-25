import { DOCUMENT } from '@angular/common';
import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

/**
 * Page 3: "Every request carries Authorization: Bearer nud_demo_7f3c. That
 * literal string is the whole of authentication."
 *
 * It is also what makes covers unfetchable by `<img src>` (RF3) — the media
 * route refuses anything without this header, and an `<img>` element cannot
 * send one.
 */
const TOKEN = 'nud_demo_7f3c';

export const authInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { Authorization: `Bearer ${TOKEN}` } }));

/** The three levers the stub understands, on any route, by query parameter. */
export const LEVER_PARAMS = ['delay', 'fail', 'empty'] as const;

/**
 * Page 2: the levers "are read from the page URL and travel to every request
 * the app makes while they are there [...] They are not application state, so
 * RF1 does not own them, nothing persists them, and changing one never pushes a
 * history entry."
 *
 * Two consequences that are easy to get wrong, and both are deliberate here:
 *
 * 1. They are read from `location.search`, not from the Router. The router
 *    state is what RF1 derives the catalogue from; keeping the levers out of it
 *    is the mechanical guarantee that they are not application state. It also
 *    reads correctly halfway through a navigation, when router state has not
 *    settled.
 *
 * 2. Because nothing in the app watches them, adding `&fail=500` to the address
 *    bar of a pack that is already on screen does not refetch anything — the
 *    screen stays exactly as it is and only the *next* request carries the
 *    lever. That is what makes RF5's failing POST reachable at all: a reviewer
 *    cannot address that request directly, and reloading the page with
 *    `fail=500` would break the GETs before the form ever rendered.
 */
export const leversInterceptor: HttpInterceptorFn = (req, next) => {
  const search = inject(DOCUMENT).defaultView?.location.search ?? '';
  if (search === '') return next(req);

  const page = new URLSearchParams(search);
  let params = req.params;

  for (const name of LEVER_PARAMS) {
    const value = page.get(name);
    // A lever the caller set explicitly wins: the page URL never overrides a
    // request that already knows what it wants.
    if (value !== null && !params.has(name)) params = params.set(name, value);
  }

  return params === req.params ? next(req) : next(req.clone({ params }));
};
