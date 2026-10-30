import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api.config';

/** Mesmas regras do backend (`image-type.ts`): JPG/PNG até 5 MB. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png'];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function photoError(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return 'Use uma imagem JPG ou PNG.';
  if (file.size > MAX_PHOTO_BYTES) return 'A imagem precisa ter até 5 MB.';
  return null;
}

/**
 * Chamadas do onboarding feitas logo após o cadastro (sessão já ativa):
 * foto de perfil e interesses, gravados pela API social.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/social/profile`;

  /** Envia o arquivo cru; o backend confere o tipo pelos magic bytes. */
  uploadPhoto(file: File): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/photo`, file, {
      headers: new HttpHeaders({ 'Content-Type': file.type }),
      withCredentials: true,
    });
  }

  saveInterests(interests: string[]): Observable<void> {
    return this.http.post<void>(this.baseUrl, { interests }, { withCredentials: true });
  }
}
