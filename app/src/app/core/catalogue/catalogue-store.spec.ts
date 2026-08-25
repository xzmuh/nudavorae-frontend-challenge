import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  type TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PacksPageDto } from '../api/contract';
import { CatalogueStore } from './catalogue-store';

function page(...ids: readonly string[]): PacksPageDto {
  return {
    items: ids.map((id) => ({
      id,
      title: id,
      creator_handle: 'lumen_ash',
      price_cents: 1999,
      cover_media_id: `med_${id}`,
      rating: '4.0',
      review_count: 4,
    })),
    next_cursor: null,
  };
}

/**
 * RF2 — "A late answer to an old question never lands. Type `lat`, then
 * `latex`, with the first response delayed. The results for `lat` must never
 * appear. Ships as a test. This is the single most common way to fail this
 * challenge."
 *
 * The test is written the way the brief describes the bug: two searches, the
 * first one still outstanding when the second is asked for, and the first one
 * answering last.
 */
describe('CatalogueStore — RF2, the stale answer', () => {
  let store: CatalogueStore;
  let http: HttpTestingController;

  const search = (q: string): void => store.load({ q, sort: 'newest' });
  const requestFor = (q: string): TestRequest =>
    http.expectOne((request) => request.params.get('q') === q);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    store = TestBed.inject(CatalogueStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('aborts the outstanding search the moment a newer one is asked for', () => {
    search('lat');
    const slow = requestFor('lat');

    search('latex');

    // Not "ignored later" — unsubscribed, which aborts the underlying request.
    // The bytes for `lat` are never received at all.
    expect(slow.cancelled).toBeTrue();

    requestFor('latex').flush(page('pack_latex'));
  });

  it('shows the newer results even when the older answer comes back last', () => {
    search('lat');
    const slow = requestFor('lat');

    search('latex');
    const fast = requestFor('latex');

    // The second search answers first, as it does when the first is delayed.
    fast.flush(page('pack_latex'));
    expect(store.items().map((item) => item.id)).toEqual(['pack_latex']);
    expect(store.status()).toBe('ready');

    // And the delayed answer to the old question arrives afterwards.
    expect(slow.cancelled).toBeTrue();

    // It changed nothing: `lat` is not on screen and never was.
    expect(store.items().map((item) => item.id)).toEqual(['pack_latex']);
    expect(store.query().q).toBe('latex');
  });

  it('does not fetch again when the URL asks for what is already loaded', () => {
    search('latex');
    requestFor('latex').flush(page('pack_latex'));

    // What a back navigation from a pack does: the same q and sort arrive
    // again. RF6 — same items, no request, no spinner.
    search('latex');

    http.expectNone(() => true);
    expect(store.status()).toBe('ready');
    expect(store.items().map((item) => item.id)).toEqual(['pack_latex']);
  });
});
