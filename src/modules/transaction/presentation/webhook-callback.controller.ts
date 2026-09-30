import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { TransactionService } from '../application/transaction.service';
import { ProviderAdapterRegistry } from '@modules/provider-adapter/application/provider-adapter.registry';
import { Public } from '@modules/authentication/presentation/decorators/public.decorator';

@Controller('api/v1/callback')
export class WebhookCallbackController {
  private readonly logger = new Logger(WebhookCallbackController.name);

  constructor(
    private readonly transactionService: TransactionService,
    private readonly adapterRegistry: ProviderAdapterRegistry,
  ) {}

  /**
   * Bước 2.2A / Bước 4: Webhook Callback tiếp nhận kết quả từ NCC (ANI SIM)
   * POST /api/v1/callback/orders
   * Response: HTTP 200 {"code": 0, "message": "Received"}
   */
  @Public()
  @Post(['orders', 'anisim'])
  @HttpCode(HttpStatus.OK)
  async handleCallback(
    @Body() payload: any,
    @Headers() headers: Record<string, any>,
  ) {
    this.logger.log(`Received Webhook Callback from supplier`);

    try {
      const adapter = this.adapterRegistry.get('ANISIM');
      if (adapter.parseWebhookCallback) {
        const statusResult = await adapter.parseWebhookCallback(
          payload,
          headers,
        );
        await this.transactionService.handleWebhookResult(statusResult);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing webhook callback: ${msg}`);
    }

    // Luôn trả về HTTP 200 Received để xác nhận đã tiếp nhận payload theo chuẩn Template API
    return {
      code: 0,
      message: 'Received',
    };
  }
}
