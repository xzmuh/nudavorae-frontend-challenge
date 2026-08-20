import { DestroyRef, Injectable, inject } from '@angular/core';
import { type Observable, map, of, shareReplay, tap } from 'rxjs';
import { CatalogApiService } from '../api/catalog-api.service';

/**
 * Images are private: they only answer with a valid `Authorization` header, so
 * they cannot be used as a plain `<img src>`. They are fetched through
 * HttpClient (interceptor signs them), turned into object URLs and cached, so
 * going back to a list never re-downloads what is already on screen.
 */
@Injectable({ providedIn: 'root' })
export class ProtectedImageService {
  private readonly api = inject(CatalogApiService);
  private readonly objectUrls = new Map<string, string>();
  private readonly inFlight = new Map<string, Observable<string>>();
  private readonly maxEntries = 600;

  constructor() {
    // Every object URL this service created is released when the app is torn
    // down; while the app lives they are kept on purpose, because that cache is
    // what makes going back to the list free of re-downloads.
    inject(DestroyRef).onDestroy(() => this.releaseAll());
  }

  load(imageId: string): Observable<string> {
    const cached = this.objectUrls.get(imageId);
    if (cached !== undefined) return of(cached);

    const pending = this.inFlight.get(imageId);
    if (pending !== undefined) return pending;

    const request = this.api.image(imageId).pipe(
      map((blob) => URL.createObjectURL(blob)),
      tap({
        next: (objectUrl) => {
          this.remember(imageId, objectUrl);
          this.inFlight.delete(imageId);
        },
        error: () => this.inFlight.delete(imageId),
      }),
      // Kept alive without refCount so a component destroyed mid-download does
      // not cancel the request; the next subscriber gets the cached result.
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.inFlight.set(imageId, request);
    return request;
  }

  /** Releases every object URL and empties the cache. */
  releaseAll(): void {
    for (const objectUrl of this.objectUrls.values()) URL.revokeObjectURL(objectUrl);
    this.objectUrls.clear();
    this.inFlight.clear();
  }

  private remember(imageId: string, objectUrl: string): void {
    this.objectUrls.set(imageId, objectUrl);
    if (this.objectUrls.size <= this.maxEntries) return;

    const oldest = this.objectUrls.keys().next();
    if (oldest.done === true) return;
    const staleUrl = this.objectUrls.get(oldest.value);
    if (staleUrl !== undefined) URL.revokeObjectURL(staleUrl);
    this.objectUrls.delete(oldest.value);
  }
}
