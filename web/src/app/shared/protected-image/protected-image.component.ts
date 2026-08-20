import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { ProtectedImageService } from '../../core/media/protected-image.service';

interface ImageState {
  status: 'loading' | 'ready' | 'error';
  url: string | null;
}

@Component({
  selector: 'app-protected-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame" [style.aspect-ratio]="ratio()">
      @if (url(); as source) {
        <img class="image" [src]="source" [alt]="alt()" decoding="async" />
      } @else if (status() === 'error') {
        <div class="fallback" role="img" [attr.aria-label]="alt()">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-13Zm2 12.9 4.6-5.1 3 3.3 3-2.4L19 18.6V5.5a.5.5 0 0 0-.5-.5h-13a.5.5 0 0 0-.5.5v12.9Z"
              fill="currentColor"
            />
          </svg>
        </div>
      } @else {
        <div class="skeleton placeholder"></div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .frame {
      position: relative;
      overflow: hidden;
      width: 100%;
      background: var(--color-surface-sunken);
      border-radius: inherit;
    }

    .image,
    .placeholder,
    .fallback {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .image {
      object-fit: cover;
      animation: fade-in var(--duration-base) var(--ease-out);
    }

    .placeholder {
      border-radius: 0;
    }

    .fallback {
      display: grid;
      place-items: center;
      color: var(--color-text-subtle);
      background: var(--color-surface-sunken);
    }

    .fallback svg {
      width: 28px;
      height: 28px;
    }
  `,
})
export class ProtectedImageComponent {
  private readonly images = inject(ProtectedImageService);

  readonly imageId = input.required<string>();
  readonly alt = input<string>('');
  readonly ratio = input<string>('16 / 10');

  private readonly state = toSignal(
    toObservable(this.imageId).pipe(
      switchMap((imageId) =>
        this.images.load(imageId).pipe(
          map((url): ImageState => ({ status: 'ready', url })),
          startWith<ImageState>({ status: 'loading', url: null }),
          catchError(() => of<ImageState>({ status: 'error', url: null })),
        ),
      ),
    ),
    { initialValue: { status: 'loading', url: null } satisfies ImageState },
  );

  readonly url = computed<string | null>(() => this.state().url);
  readonly status = computed<ImageState['status']>(() => this.state().status);
}
