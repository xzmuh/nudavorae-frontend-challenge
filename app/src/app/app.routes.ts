import type { Routes } from '@angular/router';
import { CataloguePageComponent } from './features/catalogue/catalogue-page.component';

export const routes: Routes = [
  {
    path: '',
    component: CataloguePageComponent,
    title: 'Packs — Nudavorae',
  },
  {
    // RF8: "the pack screen is a lazy route".
    path: 'packs/:id',
    loadComponent: () =>
      import('./features/pack/pack-page.component').then((m) => m.PackPageComponent),
    title: 'Pack — Nudavorae',
  },
  { path: '**', redirectTo: '' },
];
