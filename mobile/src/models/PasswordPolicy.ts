// Mesma regra do backend (backend/src/utils/passwordPolicy.ts), checada no app para avisar antes de enviar.
// Atividade 1 de Segurança: de 8 a 72 caracteres, com letra maiúscula, letra minúscula, número e símbolo.

export const PASSWORD_POLICY_MESSAGE =
  'A senha deve ter de 8 a 72 caracteres, com letra maiúscula, letra minúscula, número e símbolo.';

const CLASSES = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/];

export function meetsPasswordPolicy(senha: string): boolean {
  return senha.length >= 8 && senha.length <= 72 && CLASSES.every((regex) => regex.test(senha));
}
