import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-service-card-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" aria-hidden="true">
      <div class="skeleton media"></div>
      <div class="body">
        <div class="skeleton line line--seller"></div>
        <div class="skeleton line line--title"></div>
        <div class="skeleton line line--short"></div>
        <div class="footer">
          <div class="skeleton line line--price"></div>
          <div class="skeleton line line--meta"></div>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .card {
      overflow: hidden;
      background: var(--color-surface);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-lg);
    }

    .media {
      width: 100%;
      aspect-ratio: 16 / 10;
      border-radius: 0;
    }

    .body {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-4);
    }

    .line {
      height: 10px;
    }

    .line--seller {
      width: 45%;
    }

    .line--title {
      width: 92%;
      height: 14px;
    }

    .line--short {
      width: 60%;
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: var(--space-3);
      border-top: var(--border-width) solid var(--color-border-subtle);
    }

    .line--price {
      width: 72px;
      height: 18px;
    }

    .line--meta {
      width: 54px;
    }
  `,
})
export class ServiceCardSkeletonComponent {}
