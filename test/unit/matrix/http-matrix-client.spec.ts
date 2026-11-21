import { MatrixBot } from '../../../src/matrix/domain/entities/matrix-bot';
import { MatrixApiError } from '../../../src/matrix/domain/matrix-client';
import { HttpMatrixClient } from '../../../src/matrix/infrastructure/http/http-matrix-client';
import { MockMatrixBotRepository } from '../../mocks/mock-matrix';

describe('HttpMatrixClient and the private network', () => {
  const realFetch = global.fetch;
  let fetched: string[];
  let bots: MockMatrixBotRepository;

  beforeEach(async () => {
    fetched = [];
    global.fetch = (async (url: string) => {
      fetched.push(url);
      return new Response(JSON.stringify({ user_id: '@bot:example.org' }), { status: 200 });
    }) as typeof fetch;
    bots = new MockMatrixBotRepository();
    // The installation's own bot lives on a server inside the network
    await bots.save(new MatrixBot({ id: 'b', workspaceId: null, homeserverUrl: 'http://10.0.0.7:8008', userId: '@bot:example.org', deviceId: null, encryptedAccessToken: 'x' }));
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.ALLOW_PRIVATE_NETWORK_URLS;
  });

  it('reaches any server where private addresses are allowed (the default)', async () => {
    await new HttpMatrixClient(bots as any).whoami('http://10.9.9.9:8008', 'tok');
    expect(fetched).toEqual(['http://10.9.9.9:8008/_matrix/client/v3/account/whoami']);
  });

  describe('with ALLOW_PRIVATE_NETWORK_URLS=false', () => {
    beforeEach(() => { process.env.ALLOW_PRIVATE_NETWORK_URLS = 'false'; });

    it('never limits the installation bot\'s own server', async () => {
      await expect(new HttpMatrixClient(bots as any).whoami('http://10.0.0.7:8008', 'tok')).resolves.toEqual({ userId: '@bot:example.org', deviceId: null });
      expect(fetched).toHaveLength(1);
    });

    it('keeps a workspace\'s server off the private network, on every call, as an error that is not retried', async () => {
      const client = new HttpMatrixClient(bots as any);
      const error = await client.whoami('http://10.9.9.9:8008', 'tok').catch((e) => e);
      expect(error).toBeInstanceOf(MatrixApiError);
      expect(error).toMatchObject({ status: -1, errcode: 'OHD_PRIVATE_NETWORK', retryable: false, lostAccess: false });
      await expect(client.discoverHomeserver('localhost')).resolves.toBeNull();
      expect(fetched).toEqual([]);
    });
  });
});
