// Política de senha da Atividade 1 de Segurança: no mínimo 8 caracteres, com as 4 classes
// (letra maiúscula, letra minúscula, número e símbolo). Vale para toda senha nova: cadastro,
// troca no perfil, recuperação e criação de usuário pelo admin. O login não aplica a regra,
// para contas antigas continuarem entrando e trocarem a senha.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // limite do bcrypt: o que passa disso é ignorado no hash

export const PASSWORD_POLICY_MESSAGE =
  'A senha deve ter de 8 a 72 caracteres, com letra maiúscula, letra minúscula, número e símbolo.';

const CLASSES = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/];

export function meetsPasswordPolicy(senha: unknown): senha is string {
  if (typeof senha !== 'string') return false;
  if (senha.length < PASSWORD_MIN_LENGTH || senha.length > PASSWORD_MAX_LENGTH) return false;
  return CLASSES.every((regex) => regex.test(senha));
}
