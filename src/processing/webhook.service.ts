import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  async notify(documentId: string): Promise<void> {
    this.logger.log(`Document ${documentId} processing complete`);
  }
}
