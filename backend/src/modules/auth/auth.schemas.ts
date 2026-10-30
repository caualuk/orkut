import { z } from 'zod';
import { RELATIONSHIPS } from '../social/social.types.js';

export const loginSchema = z.object({
  email: z
    .string({ error: 'Informe o e-mail.' })
    .trim()
    .toLowerCase()
    .max(254, 'E-mail muito longo.')
    .pipe(z.email({ error: 'Informe um e-mail válido.' })),
  // Limite superior evita custo excessivo de hashing com entradas gigantes.
  password: z
    .string({ error: 'Informe a senha.' })
    .min(1, 'Informe a senha.')
    .max(128, 'Senha muito longa.'),
  remember: z.boolean().default(false),
});

export type LoginBody = z.infer<typeof loginSchema>;

/** Confirmação da senha atual para excluir a conta. */
export const deleteAccountSchema = z.object({ password: loginSchema.shape.password });

export type DeleteAccountBody = z.infer<typeof deleteAccountSchema>;

/** Idade mínima para criar conta (termos de uso). */
export const MIN_SIGNUP_AGE = 13;

function yearsSince(date: Date, now = new Date()): number {
  let years = now.getUTCFullYear() - date.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < date.getUTCMonth() ||
    (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years;
}

const nameField = (label: string) =>
  z
    .string({ error: `Informe o ${label}.` })
    .trim()
    .min(1, `Informe o ${label}.`)
    .max(40, `${label[0]?.toUpperCase()}${label.slice(1)} muito longo.`);

export const signupSchema = z.object({
  firstName: nameField('nome'),
  lastName: nameField('sobrenome'),
  email: loginSchema.shape.email,
  // Mesma regra exibida na tela: mínimo 8 caracteres, com letras e números.
  password: z
    .string({ error: 'Informe a senha.' })
    .min(8, 'A senha precisa ter ao menos 8 caracteres.')
    .max(128, 'Senha muito longa.')
    .regex(/[A-Za-z]/, 'A senha precisa ter letras.')
    .regex(/\d/, 'A senha precisa ter números.'),
  birthDate: z.iso
    .date({ error: 'Data de nascimento inválida.' })
    .refine((value) => yearsSince(new Date(value)) >= MIN_SIGNUP_AGE, {
      error: `É preciso ter ao menos ${MIN_SIGNUP_AGE} anos.`,
    })
    .refine((value) => value >= '1900-01-01', { error: 'Data de nascimento inválida.' })
    .nullish()
    .transform((value) => value ?? null),
  gender: z
    .enum(['feminino', 'masculino', 'outro', 'nao-informar'], { error: 'Opção inválida.' })
    .nullish()
    .transform((value) => value ?? null),
  relationship: z
    .enum(RELATIONSHIPS, { error: 'Opção inválida.' })
    .nullish()
    .transform((value) => value ?? 'nao-informar'),
  city: z
    .string()
    .trim()
    .max(80, 'Cidade muito longa.')
    .nullish()
    .transform((value) => value ?? ''),
  // Descrição breve da etapa 2 (vira o "Quem sou eu" do perfil).
  about: z
    .string()
    .trim()
    .max(500, 'Descrição muito longa (máx. 500).')
    .nullish()
    .transform((value) => value ?? ''),
  acceptTerms: z.literal(true, { error: 'É preciso aceitar os Termos de uso.' }),
});

export type SignupBody = z.infer<typeof signupSchema>;
