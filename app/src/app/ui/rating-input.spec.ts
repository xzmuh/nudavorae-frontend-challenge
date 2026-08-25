import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Score } from '../core/api/models';
import { RatingInputComponent } from './rating-input.component';

/**
 * RF4, the keyboard path — the third test, which page 5 calls "welcome and not
 * required".
 *
 * What it pins is the reason the keyboard works at all: this is one radio
 * group, not five buttons wearing radio roles. A browser gives a radio group
 * one tab stop, arrow-key movement and Home/End for free, and it gives none of
 * that to five separately focusable controls. Every assertion below is about
 * the structure that earns those behaviours, because the behaviours themselves
 * belong to the browser and testing them would be testing Chrome.
 */
describe('RatingInputComponent — RF4, one control carrying a value out of five', () => {
  function render(value: Score | null = null) {
    const fixture = TestBed.createComponent(RatingInputComponent);
    fixture.componentRef.setInput('name', 'score');
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return fixture;
  }

  const hostOf = (fixture: ReturnType<typeof render>): HTMLElement =>
    fixture.nativeElement as HTMLElement;

  const radiosOf = (fixture: ReturnType<typeof render>): HTMLInputElement[] =>
    Array.from(hostOf(fixture).querySelectorAll<HTMLInputElement>('input[type="radio"]'));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  it('is five radios sharing one name inside a named group', () => {
    const fixture = render();
    const radios = radiosOf(fixture);

    expect(radios.length).toBe(5);
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);

    // fieldset + legend is what makes a screen reader announce the group once,
    // as a single control, rather than announcing five unrelated ones.
    const fieldset = hostOf(fixture).querySelector('fieldset');
    const legend = fieldset?.querySelector('legend');
    expect(fieldset).not.toBeNull();
    expect(legend?.textContent?.trim()).toBe('Your rating, out of five');
  });

  it('names every option for what it is, never five identical stars', () => {
    const fixture = render();
    const labels = Array.from(
      hostOf(fixture).querySelectorAll<HTMLLabelElement>('label.star'),
    ).map((label) => label.textContent?.trim());

    expect(labels).toEqual(['1 star', '2 stars', '3 stars', '4 stars', '5 stars']);
  });

  it('opens with nothing selected on a first review', () => {
    const fixture = render(null);
    expect(radiosOf(fixture).some((radio) => radio.checked)).toBeFalse();
  });

  it('opens prefilled when the caller is changing one', () => {
    const fixture = render(4);
    expect(radiosOf(fixture).map((radio) => radio.checked)).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  it('reports the score when an option is chosen without a pointer', () => {
    const fixture = render(null);
    const chosen: Array<Score | null> = [];
    fixture.componentInstance.value.subscribe((value) => chosen.push(value));

    // What a keyboard does to a radio: it checks it and fires `change`. No
    // click, no pointer, no key handler of ours in between.
    const third = radiosOf(fixture)[2];
    third!.checked = true;
    third!.dispatchEvent(new Event('change'));

    expect(chosen).toEqual([3]);
  });
});
