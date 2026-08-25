import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PackDetailDto, ReviewsDto } from '../../core/api/contract';
import { PackStore } from './pack-store';

const PACK: PackDetailDto = {
  id: 'pack_0001',
  title: 'Latent Hours',
  description: '69 files.',
  creator_handle: 'lumen_ash',
  price_cents: 1999,
  cover_media_id: 'med_0001',
  rating: '4.0',
  review_count: 2,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 0 },
  created_at: '2025-06-01T09:30:00.000Z',
};

const REVIEWS: ReviewsDto = {
  items: [
    {
      id: 'rev_1',
      author_handle: 'oncewas',
      score: 4,
      body: 'Good.',
      created_at: '2025-06-01T09:00:00.000Z',
    },
    {
      id: 'rev_2',
      author_handle: 'penumbra_j',
      score: 4,
      body: 'Also good.',
      created_at: '2025-06-01T08:00:00.000Z',
    },
  ],
  can_review: true,
  rating: '4.0',
  review_count: 2,
};

/**
 * RF7 — "The review form cannot be sent twice and cannot lose what was typed.
 * Double-click the button, or press enter again while the first request is in
 * flight: one request leaves the browser. And when it fails, the text is still
 * in the field."
 *
 * The second `submit` here stands for both the second click and the second
 * Enter: neither reaches a `disabled` attribute, they reach this method.
 *
 * The failure case is RF5's other half — "if the request fails the screen
 * returns to the truth and says what happened" — and it is asserted in the same
 * place because it is the same event.
 */
describe('PackStore — RF7, the double send', () => {
  let store: PackStore;
  let http: HttpTestingController;

  const isPost = (): boolean => true;

  function loadPack(): void {
    store.load('pack_0001');
    http.expectOne((request) => request.url.endsWith('/packs/pack_0001')).flush(PACK);
    http.expectOne((request) => request.url.endsWith('/packs/pack_0001/reviews')).flush(REVIEWS);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        PackStore,
      ],
    });
    store = TestBed.inject(PackStore);
    http = TestBed.inject(HttpTestingController);
    loadPack();
  });

  afterEach(() => http.verify());

  it('lets exactly one request leave the browser when submit fires twice', () => {
    store.submit(5, 'Worth it for the last eight files alone.');
    store.submit(5, 'Worth it for the last eight files alone.');
    store.submit(5, 'Worth it for the last eight files alone.');

    const posts = http.match((request) => request.method === 'POST' && isPost());
    expect(posts.length).toBe(1);

    posts[0]?.flush({ rating: '4.3', review_count: 3 });
  });

  it('shows the new average at once, from exact counts rather than a rounded one', () => {
    // Two fours on screen: 4.0. Adding a five must read 4.3, not 4.5, and the
    // guess must match what the server is about to say.
    store.submit(5, 'Great.');

    expect(store.pack()?.rating).toBe('4.3');
    expect(store.pack()?.reviewCount).toBe(3);

    http.expectOne((request) => request.method === 'POST').flush({
      rating: '4.3',
      review_count: 3,
    });

    expect(store.pack()?.rating).toBe('4.3');
  });

  it('rolls the average back and says what happened when the request fails', () => {
    store.submit(1, 'Did not work for me.');

    // Optimistic: the screen already moved.
    expect(store.pack()?.rating).toBe('3.0');
    expect(store.reviews().length).toBe(3);

    http.expectOne((request) => request.method === 'POST').flush(
      { error: { code: 'injected_failure', message: 'The marketplace is having a bad minute.' } },
      { status: 500, statusText: 'Server Error' },
    );

    // Back to the truth...
    expect(store.pack()?.rating).toBe('4.0');
    expect(store.pack()?.reviewCount).toBe(2);
    expect(store.reviews().length).toBe(2);

    // ...and it says what happened, in the marketplace's own words.
    expect(store.submitError()?.message).toBe('The marketplace is having a bad minute.');

    // The guard released, so the person can try again with the text they still
    // have in the field.
    expect(store.submitting()).toBeFalse();
  });
});
