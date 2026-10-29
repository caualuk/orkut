export interface PasswordStrength {
  /** 0 (vazia) a 4 (forte). */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const LABELS = ['', 'Senha fraca', 'Senha razoável', 'Senha boa', 'Senha forte'];

/**
 * Medidor de força exibido abaixo do campo de senha. A regra mínima (8+
 * caracteres com letras e números) é validada à parte; aqui só se pontua.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '' };

  let points = 0;
  if (password.length >= 8) points++;
  if (password.length >= 12) points++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
  if (/\d/.test(password)) points++;
  if (/[^A-Za-z0-9]/.test(password)) points++;

  const score = Math.max(1, Math.min(4, points - (password.length < 8 ? 1 : 0))) as 1 | 2 | 3 | 4;
  return { score, label: LABELS[score] ?? '' };
}
