import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

/**
 * Three states, not two. RF9 asks for both "the theme survives a reload" and
 * "it follows the operating system until the user overrides it", and a boolean
 * cannot hold both: it has no way to say "I have not chosen".
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

export type ResolvedTheme = 'light' | 'dark';

/** Also read by the pre-paint script in index.html. Keep the two in step. */
export const THEME_STORAGE_KEY = 'nudavorae.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isChoice(value: string | null): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly view = this.document.defaultView;

  /** What the OS is asking for, kept live so the label is honest. */
  private readonly systemPrefersDark = signal(false);

  readonly choice = signal<ThemeChoice>(this.readStoredChoice());

  /** What is actually on screen right now. */
  readonly resolved = computed<ResolvedTheme>(() => {
    const choice = this.choice();
    if (choice !== 'system') return choice;
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  constructor() {
    const media = this.view?.matchMedia(DARK_QUERY);
    if (media !== undefined) {
      this.systemPrefersDark.set(media.matches);
      const onChange = (event: MediaQueryListEvent): void =>
        this.systemPrefersDark.set(event.matches);
      media.addEventListener('change', onChange);
      // Nothing outlives what created it, listeners included.
      inject(DestroyRef).onDestroy(() => media.removeEventListener('change', onChange));
    }

    effect(() => {
      const choice = this.choice();
      const root = this.document.documentElement;

      // `system` leaves the attribute off entirely, so the media query in
      // semantic.css is what decides. An override stamps the attribute, and the
      // [data-theme] rules outrank the media query in both directions.
      if (choice === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', choice);

      try {
        if (choice === 'system') this.view?.localStorage.removeItem(THEME_STORAGE_KEY);
        else this.view?.localStorage.setItem(THEME_STORAGE_KEY, choice);
      } catch {
        // Storage can be unavailable (private mode, blocked site data). The
        // theme still applies for this page; only the memory of it is lost.
      }
    });
  }

  /**
   * Three choices, offered as three, because a control that cycles through
   * them hides the one thing RF9 is about: `system` is not a third theme, it
   * is the absence of a choice, and the screen it produces is one of the other
   * two.
   */
  choose(choice: ThemeChoice): void {
    this.choice.set(choice);
  }

  private readStoredChoice(): ThemeChoice {
    try {
      const stored = this.view?.localStorage.getItem(THEME_STORAGE_KEY) ?? null;
      return isChoice(stored) ? stored : 'system';
    } catch {
      return 'system';
    }
  }
}
