// Regras de formulário usadas em mais de uma tela (login, cadastro, recuperação de senha, perfil).
// O backend valida de novo; aqui o objetivo é avisar antes de enviar.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const INVALID_EMAIL_MESSAGE = 'Informe um e-mail válido.';

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function isBlank(value: string | null | undefined): boolean {
  return !value || !value.trim();
}
