import { UniversalOrderDto } from './dtos/universal-order.dto';
import {
  StandardCheckResult,
  StandardOrderResult,
  StandardStatusResult,
} from './dtos/standard-results.dto';

export abstract class ProviderAdapterPort {
  abstract readonly providerCode: string;

  /** Mode 1: Kiểm tra điều kiện thuê bao / gói cước */
  abstract checkEligibility?(
    phone: string,
    packageCode: string,
    context?: Record<string, any>,
  ): Promise<StandardCheckResult>;

  /** Mode 2: Khởi tạo đơn hàng sang NCC */
  abstract createOrder(
    dto: UniversalOrderDto,
    context?: Record<string, any>,
  ): Promise<StandardOrderResult>;

  /** Mode 2: Tra cứu trạng thái đơn (Worker Polling) */
  abstract queryOrderStatus(
    supplierTransId: string,
    requestId: string,
    context?: Record<string, any>,
  ): Promise<StandardStatusResult>;

  /** Xử lý Webhook Callback đẩy về từ NCC */
  abstract parseWebhookCallback?(
    payload: any,
    headers?: Record<string, any>,
  ): Promise<StandardStatusResult>;
}
