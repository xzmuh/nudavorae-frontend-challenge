import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';

export interface SelectMenuOption {
  id: string;
  label: string;
  hint?: string;
}

/**
 * Custom dropdown built on the combobox + listbox pattern.
 *
 * No `<select>`, no component library, and no element pretending to be
 * something it is not: the trigger is a `<button>` and so is every option, with
 * the ARIA roles set explicitly. Keyboard: Enter / Space / arrows open it,
 * arrows and Home/End move, Enter or Space pick, Escape closes and gives focus
 * back to the trigger.
 */
@Component({
  selector: 'app-select-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #trigger
      type="button"
      class="trigger"
      role="combobox"
      aria-haspopup="listbox"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="listboxId"
      [attr.aria-label]="ariaLabel()"
      (click)="toggle()"
      (keydown)="onTriggerKeydown($event)"
    >
      @if (leading(); as text) {
        <span class="trigger__leading">{{ text }}</span>
      }
      <span class="trigger__value">{{ selectedLabel() }}</span>
      <svg class="trigger__chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.6 8.6 12 14l5.4-5.4 1.4 1.4-6.8 6.8-6.8-6.8 1.4-1.4Z" fill="currentColor" />
      </svg>
    </button>

    @if (open()) {
      <ul class="menu" role="listbox" [id]="listboxId" [attr.aria-label]="ariaLabel()">
        @for (option of options(); track option.id; let index = $index) {
          <li>
            <button
              #optionButton
              type="button"
              class="option"
              role="option"
              [class.option--selected]="option.id === value()"
              [attr.aria-selected]="option.id === value()"
              [attr.tabindex]="index === activeIndex() ? 0 : -1"
              (click)="choose(option.id)"
              (keydown)="onOptionKeydown($event, index)"
              (focus)="activeIndex.set(index)"
            >
              <span class="option__label">{{ option.label }}</span>
              @if (option.hint; as hint) {
                <span class="option__hint">{{ hint }}</span>
              }
              @if (option.id === value()) {
                <svg class="option__check" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9.6 16.2-3.8-3.8L4.4 13.8l5.2 5.2L20 8.6l-1.4-1.4-9 9Z" fill="currentColor" />
                </svg>
              }
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
    }

    .trigger {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      min-height: 44px;
      padding: 0 var(--space-4);
      border: var(--border-width) solid var(--color-border-strong);
      border-radius: var(--radius-pill);
      background: var(--color-surface);
      font-size: var(--text-md);
      font-weight: var(--weight-medium);
      white-space: nowrap;
      transition:
        border-color var(--duration-fast) var(--ease-out),
        background-color var(--duration-fast) var(--ease-out);
    }

    .trigger:hover {
      border-color: var(--color-accent);
    }

    .trigger[aria-expanded='true'] {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px var(--color-accent-soft);
    }

    .trigger__leading {
      color: var(--color-text-subtle);
      font-weight: var(--weight-regular);
    }

    .trigger__value {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .trigger__chevron {
      width: 16px;
      height: 16px;
      margin-left: auto;
      flex: none;
      color: var(--color-text-subtle);
      transition: transform var(--duration-fast) var(--ease-out);
    }

    .trigger[aria-expanded='true'] .trigger__chevron {
      transform: rotate(180deg);
    }

    .menu {
      position: absolute;
      right: 0;
      top: calc(100% + var(--space-2));
      z-index: var(--z-panel);
      display: grid;
      gap: 2px;
      min-width: 100%;
      width: max-content;
      max-width: min(320px, 80vw);
      max-height: 320px;
      overflow-y: auto;
      margin: 0;
      padding: var(--space-2);
      background: var(--color-surface-raised);
      border: var(--border-width) solid var(--color-border-strong);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      animation: fade-in var(--duration-fast) var(--ease-out);
    }

    .option {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      padding: var(--space-2) var(--space-3);
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      text-align: left;
      font-size: var(--text-md);
      color: var(--color-text-muted);
    }

    .option:hover {
      background: var(--color-surface-hover);
      color: var(--color-text);
    }

    .option--selected {
      background: var(--color-accent-soft);
      color: var(--color-accent);
      font-weight: var(--weight-semibold);
    }

    .option__label {
      flex: 1;
    }

    .option__hint {
      font-size: var(--text-xs);
      color: var(--color-text-subtle);
    }

    .option__check {
      width: 16px;
      height: 16px;
      flex: none;
    }
  `,
})
export class SelectMenuComponent {
  private static counter = 0;

  private readonly host = inject(ElementRef<HTMLElement>);

  readonly options = input.required<SelectMenuOption[]>();
  readonly value = model.required<string>();
  readonly ariaLabel = input<string>('Select an option');
  /** Small prefix shown before the value, e.g. "Sort:". */
  readonly leading = input<string>('');
  readonly placeholder = input<string>('Select');

  protected readonly listboxId = `select-menu-${(SelectMenuComponent.counter += 1)}`;
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);

  private readonly triggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly optionRefs = viewChildren<ElementRef<HTMLButtonElement>>('optionButton');

  protected readonly selectedLabel = computed(() => {
    const current = this.value();
    return this.options().find((option) => option.id === current)?.label ?? this.placeholder();
  });

  constructor() {
    // When the list opens, focus lands on the selected option so arrows start
    // from where the user already is.
    effect(() => {
      if (!this.open()) return;
      const buttons = this.optionRefs();
      untracked(() => {
        const index = this.options().findIndex((option) => option.id === this.value());
        const target = Math.max(0, index);
        this.activeIndex.set(target);
        buttons[target]?.nativeElement.focus();
      });
    });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target;
    if (target instanceof Node && this.host.nativeElement.contains(target)) return;
    this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.open()) return;
    this.close(true);
  }

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected choose(id: string): void {
    this.value.set(id);
    this.close(true);
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    this.open.set(true);
  }

  protected onOptionKeydown(event: KeyboardEvent, index: number): void {
    const total = this.options().length;
    let next: number | null = null;

    switch (event.key) {
      case 'ArrowDown':
        next = (index + 1) % total;
        break;
      case 'ArrowUp':
        next = (index - 1 + total) % total;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = total - 1;
        break;
      case 'Tab':
        this.close(false);
        return;
      default:
        return;
    }

    event.preventDefault();
    this.activeIndex.set(next);
    this.optionRefs()[next]?.nativeElement.focus();
  }

  private close(returnFocus: boolean): void {
    this.open.set(false);
    if (returnFocus) this.triggerRef().nativeElement.focus();
  }
}
