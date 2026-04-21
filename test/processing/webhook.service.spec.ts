import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from '../../src/processing/webhook.service';

describe('WebhookService', () => {
  let service: WebhookService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookService],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  it('does not throw when notifying', async () => {
    await expect(service.notify('test-doc-1')).resolves.toBeUndefined();
  });
});
