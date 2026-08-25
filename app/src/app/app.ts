import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { type ThemeChoice, ThemeService } from './core/theme/theme.service';

interface ThemeOption {
  readonly value: ThemeChoice;
  readonly label: string;
  /** The `d` of a 24×24 path. Icons only, so nothing here carries a colour. */
  readonly icon: string;
}

const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    value: 'system',
    label: 'System',
    icon: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H13v3h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-3H6.5A2.5 2.5 0 0 1 4 13.5v-8Zm2.5-.5a.5.5 0 0 0-.5.5v8c0 .28.22.5.5.5h11a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-11Z',
  },
  {
    value: 'light',
    label: 'Light',
    icon: 'M12 6.6a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8ZM12 1.4a1 1 0 0 1 1 1v1.8a1 1 0 1 1-2 0V2.4a1 1 0 0 1 1-1Zm0 17.4a1 1 0 0 1 1 1v1.8a1 1 0 1 1-2 0v-1.8a1 1 0 0 1 1-1ZM2.4 11h1.8a1 1 0 1 1 0 2H2.4a1 1 0 1 1 0-2Zm17.4 0h1.8a1 1 0 1 1 0 2h-1.8a1 1 0 1 1 0-2ZM5 3.6l1.3 1.3a1 1 0 0 1-1.4 1.4L3.6 5A1 1 0 0 1 5 3.6Zm12.7 12.7 1.3 1.3a1 1 0 0 1-1.4 1.4l-1.3-1.3a1 1 0 0 1 1.4-1.4ZM19 3.6A1 1 0 0 1 20.4 5l-1.3 1.3a1 1 0 1 1-1.4-1.4Zm-12.7 12.7a1 1 0 0 1 1.4 1.4L6.4 19A1 1 0 0 1 5 17.6Z',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: 'M20.6 14.6A8.6 8.6 0 0 1 9.4 3.4a8.6 8.6 0 1 0 11.2 11.2Z',
  },
];

@Component({
  selector: 'nud-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink],
  template: `
    <a class="skip" href="#main">Skip to content</a>

    <header class="header">
      <div class="header__inner">
        <a class="brand" routerLink="/">
          <span class="brand__mark" aria-hidden="true"></span>
          <span class="brand__name">nudavorae</span>
        </a>

        <!--
          Three choices offered as three, not a button that cycles them. There
          are two themes; "system" is the absence of a choice, and a cycling
          button makes it look like a third. Radios, so the group is one tab
          stop with arrow keys, and so the current choice is readable rather
          than inferred from a label.
        -->
        <fieldset class="theme">
          <legend class="visually-hidden">Theme</legend>
          @for (option of themeOptions; track option.value) {
            <input
              class="theme__radio"
              type="radio"
              name="theme"
              [id]="'theme-' + option.value"
              [checked]="theme.choice() === option.value"
              (change)="theme.choose(option.value)"
            />
            <label class="theme__option" [for]="'theme-' + option.value">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path [attr.d]="option.icon" />
              </svg>
              <span class="theme__text">{{ option.label }}</span>
              @if (option.value === 'system') {
                <span class="visually-hidden">, currently {{ resolved() }}</span>
              }
            </label>
          }
        </fieldset>
      </div>
    </header>

    <main id="main" class="main">
      <router-outlet />
    </main>
  `,
  styles: `
    .skip {
      position: absolute;
      inset-inline-start: var(--space-4);
      inset-block-start: calc(var(--space-4) * -4);
      z-index: 10;
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-control);
      background: var(--surface-raised);
      color: var(--text-primary);
      box-shadow: var(--shadow-overlay);
      text-decoration: none;
      transition: inset-block-start var(--duration-slow) var(--ease);
    }

    .skip:focus-visible {
      inset-block-start: var(--space-4);
    }

    .header {
      position: sticky;
      inset-block-start: 0;
      z-index: 5;
      border-block-end: 1px solid var(--border-subtle);
      background: var(--surface-header);
      backdrop-filter: blur(12px);
    }

    .header__inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      max-inline-size: var(--page-max);
      margin-inline: auto;
      /* The token is the whole header, border included; this is the box inside
         it. Setting it here rather than letting the contents decide is what
         makes --header-height true instead of a guess. */
      block-size: calc(var(--header-height) - 1px);
      padding-inline: var(--space-6);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-block-size: var(--target-min);
      text-decoration: none;
    }

    /* Page 6: "Nothing else in the interface is a gradient." */
    .brand__mark {
      inline-size: 22px;
      block-size: 22px;
      border-radius: var(--radius-inset);
      background: var(--brand-gradient);
    }

    .brand__name {
      font-family: var(--font-heading);
      font-size: var(--text-18);
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .theme {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      margin: 0;
      padding: 3px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-control);
      background: var(--surface-raised);
      min-inline-size: 0;
    }

    /* Present to the keyboard and to a screen reader, invisible on screen: the
       label beside it is the thing you see. */
    .theme__radio {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      margin: 0;
      opacity: 0;
      pointer-events: none;
    }

    .theme__option {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      /* Page 6: 44px minimum target. The label is the target — the radio
         beside it is a 1px box the pointer never reaches. */
      min-block-size: var(--target-min);
      padding-inline: var(--space-3);
      border-radius: calc(var(--radius-control) - 3px);
      color: var(--text-secondary);
      font-size: var(--text-14);
      cursor: pointer;
      transition:
        background-color var(--duration-fast) var(--ease),
        color var(--duration-fast) var(--ease);
    }

    .theme__option:hover {
      color: var(--text-primary);
    }

    .theme__radio:checked + .theme__option {
      background: var(--surface-hover);
      color: var(--text-primary);
      font-weight: 500;
    }

    .theme__radio:focus-visible + .theme__option {
      outline: var(--focus-ring-width) solid var(--focus-ring);
      outline-offset: 1px;
    }

    .theme svg {
      inline-size: 17px;
      block-size: 17px;
      flex: none;
      fill: currentColor;
    }

    /* Below the widest phone the labels go and the icons carry it; the radios
       keep their names either way. */
    @media (max-width: 44rem) {
      .theme__text {
        display: none;
      }

      .theme__option {
        padding-inline: var(--space-2);
      }
    }

    .main {
      max-inline-size: var(--page-max);
      margin-inline: auto;
      padding: var(--space-8) var(--space-6) var(--space-16);
    }
  `,
})
export class AppComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly resolved = this.theme.resolved;
  protected readonly themeOptions = THEME_OPTIONS;

  constructor() {
    // RF6 owns the scroll offset of the catalogue. Leaving the browser's own
    // restoration on means it also tries, on content that has not rendered yet.
    const view = inject(DOCUMENT).defaultView;
    if (view !== null && 'scrollRestoration' in view.history) {
      view.history.scrollRestoration = 'manual';
    }
  }
}
