/**
 * Efeitos guiados pelo ponteiro só fazem sentido com mouse/trackpad e quando o
 * usuário não pediu redução de movimento (Motion spec · item 09).
 */
export function allowsPointerMotion(win: Window | null): boolean {
  if (!win?.matchMedia) return false;
  const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = win.matchMedia('(hover: hover) and (pointer: fine)').matches;
  return finePointer && !reducedMotion;
}
