import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { ChaosPanelComponent } from './features/lab/chaos-panel.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ChaosPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly theme = inject(ThemeService);

  readonly mode = this.theme.mode;
  readonly themeLabel = computed(() =>
    this.mode() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
  );

  protected toggleTheme(): void {
    this.theme.toggle();
  }
}
