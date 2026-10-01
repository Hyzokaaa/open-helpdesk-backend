import { CreateApiKey } from '../../../src/api-key/domain/services/api-key-create';
import { ApiKeyScope } from '../../../src/api-key/domain/enums/api-key-scope.enum';
import { ApiKey } from '../../../src/api-key/domain/entities/api-key';
import { DomainValidationError } from '../../../src/shared/domain/errors';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';

describe('CreateApiKey', () => {
  const created: ApiKey[] = [];
  const repository = { create: async (key: ApiKey) => { created.push(key); } } as any;
  const service = new CreateApiKey(new FakeIdGenerator(), repository);
  const create = (scopes?: string[]) =>
    service.execute({ workspaceId: 'ws-1', name: 'Integration', scopes, createdById: 'admin-1' });

  it('never grants the admin exchange scope by default', async () => {
    const { apiKey } = await create();

    expect(apiKey.scopes).toContain(ApiKeyScope.AUTH_EXCHANGE);
    expect(apiKey.scopes).not.toContain(ApiKeyScope.AUTH_EXCHANGE_ADMIN);
  });

  it('grants the admin exchange scope when asked for, together with the exchange', async () => {
    const { apiKey } = await create([ApiKeyScope.AUTH_EXCHANGE, ApiKeyScope.AUTH_EXCHANGE_ADMIN]);

    expect(apiKey.scopes).toContain(ApiKeyScope.AUTH_EXCHANGE_ADMIN);
  });

  it('refuses the admin exchange scope without the exchange itself', async () => {
    await expect(create([ApiKeyScope.AUTH_EXCHANGE_ADMIN])).rejects.toThrow(DomainValidationError);
  });
});
