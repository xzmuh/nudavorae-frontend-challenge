import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { PacksPageDto } from '../../core/api/contract';
import { CatalogueStore } from '../../core/catalogue/catalogue-store';
import { CataloguePageComponent } from './catalogue-page.component';

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
 * RF6, the half that is not the cache — "Back from a pack returns to the list as
 * it was: same items, same scroll position".
 *
 * The items are pinned in `catalogue-store.spec.ts`, because they are the
 * store's job. The offset is pinned here, because it is not: it depends on
 * *when* the page reads `scrollY`, and that is the whole bug.
 *
 * A `DestroyRef` hook looks like the obvious place to read it and is the wrong
 * one. Angular runs destroy hooks after it has detached the view, so by then the
 * document has collapsed to the height of whatever comes next and the browser
 * has already clamped `scrollY` to zero. The page remembers zero, restores
 * nothing, and every other part of RF6 keeps working — which is exactly the
 * kind of failure the brief says looks perfect in a demo.
 *
 * So the assertion is about the moment, not the mechanism: by the time a
 * navigation has *started*, the offset is already in the store.
 */
describe('CataloguePageComponent — RF6, the scroll offset', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let store: CatalogueStore;

  const flushFirstPage = (): void => {
    http.expectOne((request) => request.url.endsWith('/packs')).flush(page('pack_a', 'pack_b'));
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(
          [
            { path: '', component: CataloguePageComponent },
            { path: 'packs/:id', children: [] },
          ],
          withInMemoryScrolling({ scrollPositionRestoration: 'disabled' }),
        ),
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(CatalogueStore);
  });

  afterEach(() => {
    // Rendering cards renders their covers, and RF3 means each of those is a
    // real request. They are not what this file is about, so they are drained
    // rather than asserted — `protected-image` has its own reasons to exist.
    http.match((request) => request.url.includes('/media/'));
    http.verify();
  });

  it('has remembered the offset by the time a navigation starts', async () => {
    await harness.navigateByUrl('/', CataloguePageComponent);
    flushFirstPage();
    await harness.fixture.whenStable();

    // What scrolling the list to somewhere looks like to the page.
    window.scrollTo(0, 640);
    expect(store.scrollToRestore({ q: '', sort: 'newest' })).toBe(0);

    // Leaving for a pack. The assertion is made from inside the navigation,
    // before anything has been torn down — a hook that ran later would read a
    // scrollY the browser had already clamped.
    await harness.navigateByUrl('/packs/pack_a');

    expect(store.scrollToRestore({ q: '', sort: 'newest' })).toBe(640);

    window.scrollTo(0, 0);
  });

  it('offers nothing to restore once the query changes', async () => {
    await harness.navigateByUrl('/', CataloguePageComponent);
    flushFirstPage();
    await harness.fixture.whenStable();

    window.scrollTo(0, 640);
    await harness.navigateByUrl('/packs/pack_a');
    expect(store.scrollToRestore({ q: '', sort: 'newest' })).toBe(640);

    // A different q is a different list, and page 3 says the cursor stops being
    // valid on exactly that event. The offset goes with it: restoring 640px
    // into someone else's results is worse than not restoring at all.
    expect(store.scrollToRestore({ q: 'latex', sort: 'newest' })).toBeNull();

    window.scrollTo(0, 0);
  });
});
