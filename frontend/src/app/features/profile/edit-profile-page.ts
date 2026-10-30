import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  GENDER_LABELS,
  RELATIONSHIP_LABELS,
  SUGGESTED_INTERESTS,
  type Gender,
  type Profile,
  type Relationship,
} from '../../core/social/social.models';
import { parseYouTubeId, youTubeLink } from '../../core/social/profile-music';
import { SocialStore } from '../../core/social/social.store';
import { ProfilePhoto } from '../../shared/ui/profile-photo/profile-photo';

type Tab = 'geral' | 'social' | 'contato' | 'profissional';

export const ABOUT_MAX_LENGTH = 500;
const MAX_INTERESTS = 12;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** Mesma regra da API: letras (inclusive acentuadas), espaço, apóstrofo e hífen. */
const NAME_PATTERN = /^[\p{L}\p{M}' -]*$/u;

/** Vazio é válido (sem música); preenchido precisa ser um link do YouTube. */
function youTubeLinkValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  return !value || parseYouTubeId(value) ? null : { youtube: true };
}

/** Editar perfil ("Editar perfil · Desktop 1440", "M · Editar perfil"). */
@Component({
  selector: 'ok-edit-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, NgTemplateOutlet, ProfilePhoto, ReactiveFormsModule],
  templateUrl: './edit-profile-page.html',
  styleUrl: './edit-profile-page.css',
})
export class EditProfilePage {
  protected readonly store = inject(SocialStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'geral', label: 'Geral' },
    { id: 'social', label: 'Social' },
    { id: 'contato', label: 'Contato' },
    { id: 'profissional', label: 'Profissional' },
  ];
  protected readonly tab = signal<Tab>('geral');

  protected readonly genders = Object.entries(GENDER_LABELS) as [Gender, string][];
  protected readonly relationships = Object.entries(RELATIONSHIP_LABELS) as [
    Relationship,
    string,
  ][];
  protected readonly aboutMax = ABOUT_MAX_LENGTH;
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly photoUrl = signal(this.store.profile().photoUrl);
  protected readonly uploading = signal(false);
  protected readonly interests = signal<string[]>([...this.store.profile().interests]);
  protected readonly interestOptions = signal<string[]>(
    unique([...SUGGESTED_INTERESTS, ...this.store.profile().interests]),
  );
  protected readonly addingInterest = signal(false);
  protected readonly newInterest = signal('');

  protected readonly form = this.fb.group({
    firstName: [
      '',
      [Validators.required, Validators.maxLength(40), Validators.pattern(NAME_PATTERN)],
    ],
    lastName: ['', [Validators.maxLength(40), Validators.pattern(NAME_PATTERN)]],
    gender: this.fb.control<Gender>('nao-informar'),
    relationship: this.fb.control<Relationship>('nao-informar'),
    birthday: [''],
    city: ['', Validators.maxLength(80)],
    about: ['', Validators.maxLength(ABOUT_MAX_LENGTH)],
    musicUrl: ['', youTubeLinkValidator],
    musicTitle: ['', Validators.maxLength(80)],
    social: this.fb.group({
      humor: ['', Validators.maxLength(60)],
      style: ['', Validators.maxLength(60)],
      pets: ['', Validators.maxLength(60)],
      smoking: ['', Validators.maxLength(60)],
      drinking: ['', Validators.maxLength(60)],
    }),
    contact: this.fb.group({
      phone: ['', [Validators.maxLength(20), Validators.pattern(/^[\d\s()+-]*$/)]],
      website: ['', [Validators.maxLength(120), Validators.pattern(/^(https?:\/\/\S+)?$/)]],
    }),
    professional: this.fb.group({
      education: ['', Validators.maxLength(80)],
      company: ['', Validators.maxLength(80)],
      role: ['', Validators.maxLength(80)],
    }),
  });

  constructor() {
    // O perfil chega da API depois de a tela abrir: preenche o formulário quando
    // ele chegar (ou mudar no servidor), sem sobrescrever o que já foi editado.
    effect(() => {
      this.store.profile();
      untracked(() => {
        if (!this.form.dirty) this.reset();
      });
    });
  }

  protected toggleInterest(interest: string): void {
    this.interests.update((list) =>
      list.includes(interest)
        ? list.filter((item) => item !== interest)
        : list.length < MAX_INTERESTS
          ? [...list, interest]
          : list,
    );
  }

  protected addInterest(): void {
    const value = this.newInterest().trim().slice(0, 30);
    if (value) {
      this.interestOptions.update((list) => unique([...list, value]));
      if (!this.interests().includes(value)) this.toggleInterest(value);
    }
    this.newInterest.set('');
    this.addingInterest.set(false);
  }

  /** A foto é enviada na hora (com prévia local enquanto sobe). */
  protected async onPhoto(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > MAX_PHOTO_BYTES) {
      this.snackBar.open('Use uma imagem JPG ou PNG de até 5 MB.', 'OK', { duration: 4000 });
      return;
    }
    const preview = URL.createObjectURL(file);
    this.photoUrl.set(preview);
    this.uploading.set(true);
    const ok = await this.store.uploadProfilePhoto(file);
    this.uploading.set(false);
    URL.revokeObjectURL(preview);
    this.photoUrl.set(this.store.profile().photoUrl);
    this.snackBar.open(ok ? 'Foto atualizada!' : 'Não foi possível enviar a foto.', 'OK', {
      duration: 3000,
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const firstInvalidTab = (['geral', 'social', 'contato', 'profissional'] as Tab[]).find(
        (tab) => this.tabHasError(tab),
      );
      if (firstInvalidTab) this.tab.set(firstInvalidTab);
      return;
    }

    const { musicUrl, musicTitle, ...value } = this.form.getRawValue();
    const videoId = parseYouTubeId(musicUrl);
    this.store.updateProfile({
      ...value,
      music: videoId ? { videoId, title: musicTitle.trim() || 'Música do perfil' } : null,
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      interests: this.interests(),
    } satisfies Partial<Profile>);
    this.form.markAsPristine();
    this.snackBar.open('Perfil atualizado!', 'OK', { duration: 3000 });
  }

  protected reset(): void {
    const profile = this.store.profile();
    this.form.reset({
      firstName: profile.firstName,
      lastName: profile.lastName,
      gender: profile.gender,
      relationship: profile.relationship,
      birthday: profile.birthday,
      city: profile.city,
      about: profile.about,
      musicUrl: profile.music ? youTubeLink(profile.music.videoId) : '',
      musicTitle: profile.music?.title ?? '',
      social: profile.social,
      contact: profile.contact,
      professional: profile.professional,
    });
    this.interests.set([...profile.interests]);
    this.photoUrl.set(profile.photoUrl);
  }

  protected tabHasError(tab: Tab): boolean {
    const c = this.form.controls;
    switch (tab) {
      case 'geral':
        return [c.firstName, c.lastName, c.city, c.about, c.musicUrl].some(
          (control) => control.invalid,
        );
      case 'social':
        return c.social.invalid;
      case 'contato':
        return c.contact.invalid;
      case 'profissional':
        return c.professional.invalid;
    }
  }
}

function unique(list: string[]): string[] {
  return [...new Set(list)];
}
