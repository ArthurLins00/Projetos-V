import { resolveMailFrom } from '../../config/env';

describe('resolveMailFrom', () => {
  it('mantém o MAIL_FROM quando ele já tem endereço', () => {
    expect(resolveMailFrom('Fiscalize <contato@example.com>', 'conta@gmail.com')).toBe('Fiscalize <contato@example.com>');
  });

  it('usa a conta do SMTP quando o MAIL_FROM tem só o nome', () => {
    expect(resolveMailFrom('Fiscalize', 'conta@gmail.com')).toBe('Fiscalize <conta@gmail.com>');
  });

  it('usa o nome padrão com a conta do SMTP quando o MAIL_FROM está vazio', () => {
    expect(resolveMailFrom(undefined, 'conta@gmail.com')).toBe('Fiscalize <conta@gmail.com>');
  });

  it('cai no endereço no-reply quando não há conta do SMTP', () => {
    expect(resolveMailFrom('', '')).toBe('Fiscalize <no-reply@fiscalize.gov.br>');
  });
});
