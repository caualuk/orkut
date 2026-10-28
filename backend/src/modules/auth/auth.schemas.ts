import { z } from 'zod';

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
