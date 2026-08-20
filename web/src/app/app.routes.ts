import type { Routes } from '@angular/router';
import { CatalogPageComponent } from './features/catalog/catalog-page.component';
import { ServiceDetailPageComponent } from './features/service-detail/service-detail-page.component';

export const routes: Routes = [
  { path: '', component: CatalogPageComponent, title: 'Browse services — Servio' },
  { path: 'services/:id', component: ServiceDetailPageComponent, title: 'Service — Servio' },
  { path: '**', redirectTo: '' },
];
