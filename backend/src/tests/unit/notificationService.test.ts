jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../services/mailService', () => ({ mailService: { send: jest.fn() } }));

import { prisma } from '../../config/__mocks__/prisma';
import { mailService } from '../../services/mailService';
import { notificationService } from '../../services/notificationService';

const sendMail = mailService.send as jest.Mock;
const fetchMock = jest.fn();

const UPDATE = { titulo: 'Status atualizado', mensagem: 'Seu chamado agora está "Em Andamento".', tipo: 'status_atualizado' as const };

describe('notificationService (unitário)', () => {
  beforeEach(() => {
    sendMail.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as any;
    prisma.chamado.findUnique.mockResolvedValue({
      protocolo: 'DEM-20261013-ABCD',
      subcategoria: 'Poste apagado',
      cidadao: { usuario: { id: 'cidadao-1', nome: 'Maria', email: 'maria@example.com' } },
    } as any);
    prisma.push_token.findMany.mockResolvedValue([]);
  });

  it('registra a notificação e envia e-mail para o cidadão', async () => {
    await notificationService.notifyDemandUpdate('chamado-1', UPDATE);

    expect(prisma.notificacao.create).toHaveBeenCalledWith({
      data: { usuarioid: 'cidadao-1', chamadoid: 'chamado-1', titulo: UPDATE.titulo, mensagem: UPDATE.mensagem, tipo: 'status_atualizado' },
    });
    expect(sendMail).toHaveBeenCalledWith(
      'maria@example.com',
      expect.stringContaining('DEM-20261013-ABCD'),
      expect.stringContaining(UPDATE.mensagem),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia push para os aparelhos do cidadão e remove tokens que não existem mais', async () => {
    prisma.push_token.findMany.mockResolvedValue([{ token: 'ExponentPushToken[ok]' }, { token: 'ExponentPushToken[velho]' }] as any);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
    });

    await notificationService.notifyDemandUpdate('chamado-1', UPDATE);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    const mensagens = JSON.parse(init.body);
    expect(mensagens).toHaveLength(2);
    expect(mensagens[0]).toMatchObject({ to: 'ExponentPushToken[ok]', body: UPDATE.mensagem, data: { demandId: 'chamado-1' } });
    expect(prisma.push_token.deleteMany).toHaveBeenCalledWith({ where: { token: { in: ['ExponentPushToken[velho]'] } } });
  });

  it('falha no e-mail ou no push não interrompe o fluxo', async () => {
    sendMail.mockRejectedValue(new Error('SMTP fora do ar'));
    prisma.push_token.findMany.mockResolvedValue([{ token: 'ExponentPushToken[ok]' }] as any);
    fetchMock.mockRejectedValue(new Error('sem rede'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(notificationService.notifyDemandUpdate('chamado-1', UPDATE)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it('não faz nada se o chamado não existir', async () => {
    prisma.chamado.findUnique.mockResolvedValue(null);

    await notificationService.notifyDemandUpdate('nao-existe', UPDATE);

    expect(prisma.notificacao.create).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('registra token de push válido e recusa token em formato inválido', async () => {
    await notificationService.registerPushToken('cidadao-1', 'ExponentPushToken[abc123]');
    expect(prisma.push_token.upsert).toHaveBeenCalledWith({
      where: { token: 'ExponentPushToken[abc123]' },
      create: { usuarioid: 'cidadao-1', token: 'ExponentPushToken[abc123]' },
      update: { usuarioid: 'cidadao-1' },
    });

    await expect(notificationService.registerPushToken('cidadao-1', 'qualquer-coisa')).rejects.toMatchObject({ statusCode: 400 });
  });
});
