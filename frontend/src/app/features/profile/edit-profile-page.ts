import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  GENDER_LABELS,
  RELATIONSHIP_LABELS,
  type Gender,
  type Profile,
  type Relationship,
} from '../../core/social/social.models';
import { SUGGESTED_INTERESTS } from '../../core/social/social.seed';
import { SocialStore } from '../../core/social/social.store';
import { ProfilePhoto } from '../../shared/ui/profile-photo/profile-photo';

type Tab = 'geral' | 'social' | 'contato' | 'profissional' | 'pessoal';

export const ABOUT_MAX_LENGTH = 500;
const MAX_INTERESTS = 12;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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
    { id: 'pessoal', label: 'Pessoal' },
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
  protected readonly interests = signal<string[]>([...this.store.profile().interests]);
  protected readonly interestOptions = signal<string[]>(
    unique([...SUGGESTED_INTERESTS, ...this.store.profile().interests]),
  );
  protected readonly addingInterest = signal(false);
  protected readonly newInterest = signal('');

  protected readonly form = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(40)]],
    lastName: ['', Validators.maxLength(40)],
    gender: this.fb.control<Gender>('nao-informar'),
    relationship: this.fb.control<Relationship>('nao-informar'),
    birthday: [''],
    city: ['', Validators.maxLength(80)],
    about: ['', Validators.maxLength(ABOUT_MAX_LENGTH)],
    social: this.fb.group({
      humor: ['', Validators.maxLength(60)],
      style: ['', Validators.maxLength(60)],
      pets: ['', Validators.maxLength(60)],
      smoking: ['', Validators.maxLength(60)],
      drinking: ['', Validators.maxLength(60)],
    }),
    contact: this.fb.group({
      phone: ['', [Validators.maxLength(20), Validators.pattern(/^[\d\s()+-]*$/)]],
      website: ['', [Validators.maxLength(200), Validators.pattern(/^(https?:\/\/\S+)?$/)]],
    }),
    professional: this.fb.group({
      education: ['', Validators.maxLength(80)],
      company: ['', Validators.maxLength(80)],
      role: ['', Validators.maxLength(80)],
    }),
    personal: this.fb.group({
      music: ['', Validators.maxLength(200)],
      movies: ['', Validators.maxLength(200)],
      books: ['', Validators.maxLength(200)],
      passions: ['', Validators.maxLength(200)],
    }),
  });

  constructor() {
    this.reset();
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

  protected onPhoto(files: FileList | null): void {
    const file = files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > MAX_PHOTO_BYTES) {
      this.snackBar.open('Use uma imagem JPG ou PNG de até 5 MB.', 'OK', { duration: 4000 });
      return;
    }
    this.photoUrl.set(URL.createObjectURL(file));
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const firstInvalidTab = (
        ['geral', 'social', 'contato', 'profissional', 'pessoal'] as Tab[]
      ).find((tab) => this.tabHasError(tab));
      if (firstInvalidTab) this.tab.set(firstInvalidTab);
      return;
    }

    const value = this.form.getRawValue();
    this.store.updateProfile({
      ...value,
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      interests: this.interests(),
      photoUrl: this.photoUrl(),
    } satisfies Partial<Profile>);
    this.form.markAsPristine();
    this.snackBar.open('Perfil atualizado!', 'OK', { duration: 3000 });
  }

  protected reset(): void {
    const profile = this.store.profile();
    const [firstName = '', ...rest] = this.store.displayName().split(' ');
    this.form.reset({
      firstName,
      lastName: rest.join(' '),
      gender: profile.gender,
      relationship: profile.relationship,
      birthday: profile.birthday,
      city: profile.city,
      about: profile.about,
      social: profile.social,
      contact: profile.contact,
      professional: profile.professional,
      personal: profile.personal,
    });
    this.interests.set([...profile.interests]);
    this.photoUrl.set(profile.photoUrl);
  }

  protected tabHasError(tab: Tab): boolean {
    const c = this.form.controls;
    switch (tab) {
      case 'geral':
        return [c.firstName, c.lastName, c.city, c.about].some((control) => control.invalid);
      case 'social':
        return c.social.invalid;
      case 'contato':
        return c.contact.invalid;
      case 'profissional':
        return c.professional.invalid;
      case 'pessoal':
        return c.personal.invalid;
    }
  }
}

function unique(list: string[]): string[] {
  return [...new Set(list)];
}
