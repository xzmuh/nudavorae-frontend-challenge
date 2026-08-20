import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import type { ChaosRule, ChaosRuleInput } from './models';

/**
 * Client for the API's fault-injection endpoints. Used by the in-app Lab panel
 * so the reviewer can make one specific response slow or failing without
 * touching curl.
 */
@Injectable({ providedIn: 'root' })
export class ChaosApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(): Observable<{ items: ChaosRule[] }> {
    return this.http.get<{ items: ChaosRule[] }>(`${this.baseUrl}/api/__chaos/rules`);
  }

  create(input: ChaosRuleInput): Observable<ChaosRule> {
    return this.http.post<ChaosRule>(`${this.baseUrl}/api/__chaos/rules`, input);
  }

  remove(ruleId: string): Observable<{ deleted: string }> {
    return this.http.delete<{ deleted: string }>(`${this.baseUrl}/api/__chaos/rules/${ruleId}`);
  }

  clear(): Observable<{ cleared: boolean }> {
    return this.http.delete<{ cleared: boolean }>(`${this.baseUrl}/api/__chaos/rules`);
  }
}
