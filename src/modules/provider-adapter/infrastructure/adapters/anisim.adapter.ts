import { Injectable, Logger } from '@nestjs/common';
import { ProviderAdapterPort } from '../../domain/provider-adapter.port';
import { UniversalOrderDto } from '../../domain/dtos/universal-order.dto';
import {
  StandardCheckResult,
  StandardOrderResult,
  StandardStatusResult,
} from '../../domain/dtos/standard-results.dto';

export interface AnisimPackagePlan {
  id: string;
  code: string;
  name: string;
  cycleDays: number;
  dataGbPerDay: number;
  canActivate: boolean;
  canTopup: boolean;
  status: number;
}

interface AnisimApiResponse<T = unknown> {
  code: number;
  message?: string;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
}

interface AnisimOrderData {
  id?: string;
  code?: string;
  orderId?: string;
  requestId?: string;
  status?: number | string;
  msisdn?: string;
  phone?: string;
  serial?: string;
  lpa?: string;
  lpaString?: string;
  urlLpa?: string;
  qrUrl?: string;
  costPrice?: number;
  costAmount?: number;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  reason?: string;
  items?: AnisimOrderData[];
}

interface StandardWebhookPayload {
  eventId?: string;
  requestId?: string;
  supplierTransId?: string;
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  data?: {
    phone?: string;
    msisdn?: string;
    packageCode?: string;
    serial?: string;
    costAmount?: number;
    supplierTransId?: string;
    lpa?: string;
    urlLpa?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

@Injectable()
export class AnisimAdapter implements ProviderAdapterPort {
  readonly providerCode = 'ANISIM';
  private readonly logger = new Logger(AnisimAdapter.name);

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = process.env.ANISIM_BASE_URL || 'https://ap1.anipay.vn';
    this.apiKey = process.env.ANISIM_API_KEY || 'ANI_SIM_API_KEY_DEFAULT';
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };
  }

  /**
   * Mode 1: Lấy danh mục gói cước từ ANI SIM
   */
  async fetchPackagePlans(): Promise<AnisimPackagePlan[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/agency/package-plans`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(
          `ANI SIM fetchPackagePlans failed: HTTP ${response.status}`,
        );
      }

      const res = (await response.json()) as AnisimApiResponse<{
        items?: AnisimPackagePlan[];
      }>;
      if (res.code === 0 && res.data?.items) {
        return res.data.items;
      }
      return [];
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching package plans from ANI SIM: ${msg}`);
      return [];
    }
  }

  /**
   * Mode 1: Kiểm tra điều kiện gói cước
   * ANI SIM không có API check số điện thoại trước kích hoạt.
   * Adapter kiểm tra tính khả dụng của gói cước (canActivate, status = 1) và serial SIM nếu có.
   */
  checkEligibility(
    phone: string,
    packageCode: string,
    context?: Record<string, any>,
  ): Promise<StandardCheckResult> {
    this.logger.log(
      `Checking eligibility for package ${packageCode}, phone: ${phone}`,
    );

    const packagePlan = context?.packagePlan as AnisimPackagePlan | undefined;
    if (packagePlan) {
      if (!packagePlan.canActivate || packagePlan.status !== 1) {
        return Promise.resolve({
          isEligible: false,
          reason: `Package ${packageCode} is currently inactive or cannot be activated`,
          rawResponse: packagePlan,
        });
      }
    }

    if (context?.serial) {
      const serial = String(context.serial);
      if (serial.length < 18 || serial.length > 22) {
        return Promise.resolve({
          isEligible: false,
          reason: `Invalid SIM serial/ICCID length: ${serial}`,
        });
      }
    }

    return Promise.resolve({
      isEligible: true,
      reason: 'Package is active and eligible for activation',
    });
  }

  /**
   * Mode 2: Khởi tạo đơn hàng kích hoạt SIM / gói cước sang ANI SIM
   * POST /api/v1/agency/orders
   */
  async createOrder(
    dto: UniversalOrderDto,
    context?: Record<string, any>,
  ): Promise<StandardOrderResult> {
    const packagePlanId = String(
      context?.packagePlanId || dto.metadata?.packagePlanId || dto.packageCode,
    );

    const payload: Record<string, string> = {
      requestId: dto.requestId,
      packagePlanId,
    };

    if (dto.serial) {
      payload.serial = dto.serial;
    }

    this.logger.log(
      `Sending create order to ANI SIM: requestId=${dto.requestId}, packagePlanId=${packagePlanId}`,
    );

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/agency/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      const res = (await response.json()) as AnisimApiResponse<AnisimOrderData>;

      if (!response.ok || res.code !== 0) {
        const errorMsg = res.message || `HTTP ${response.status}`;
        this.logger.error(`ANI SIM createOrder failed: ${errorMsg}`);
        return {
          supplierTransId: '',
          status: 'FAILED',
          message: errorMsg,
          rawResponse: res,
        };
      }

      // Trạng thái ANI SIM khi tạo đơn thành công: status 1 (PENDING) -> Core PROCESSING
      const supplierTransId = String(res.data?.id || res.data?.code || '');

      return {
        supplierTransId,
        status: 'PROCESSING',
        suggestedPollDelaySec: 5,
        message: res.message || 'Order accepted by ANI SIM',
        rawResponse: res,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Exception calling ANI SIM createOrder: ${msg}`);
      return {
        supplierTransId: '',
        status: 'FAILED',
        message: msg,
      };
    }
  }

  /**
   * Mode 2: Tra cứu trạng thái đơn hàng (Polling Fallback)
   * GET /api/v1/agency/orders?keyword={requestId}
   */
  async queryOrderStatus(
    supplierTransId: string,
    requestId: string,
  ): Promise<StandardStatusResult> {
    this.logger.log(
      `Polling ANI SIM order status: supplierTransId=${supplierTransId}, requestId=${requestId}`,
    );

    try {
      const queryParam = encodeURIComponent(requestId || supplierTransId);
      const url = `${this.baseUrl}/api/v1/agency/orders?keyword=${queryParam}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(
          `ANI SIM queryOrderStatus failed: HTTP ${response.status}`,
        );
      }

      const res = (await response.json()) as AnisimApiResponse<AnisimOrderData>;
      if (res.code !== 0) {
        return {
          supplierTransId,
          requestId,
          status: 'FAILED',
          errorCode: String(res.code),
          errorMessage: res.message,
          rawResponse: res,
        };
      }

      const item = Array.isArray(res.data?.items)
        ? res.data.items[0]
        : res.data;

      if (!item) {
        return {
          supplierTransId,
          requestId,
          status: 'PROCESSING',
          rawResponse: res,
        };
      }

      return this.mapAnisimItemToStatusResult(item, supplierTransId, requestId);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Exception querying ANI SIM status: ${msg}`);
      return {
        supplierTransId,
        requestId,
        status: 'PROCESSING',
        errorMessage: msg,
      };
    }
  }

  /**
   * Mode 2: Tiếp nhận và phân tích Webhook Callback từ ANI SIM
   * Header: X-MK-Callback-Event: ORDER_RESULT
   */
  parseWebhookCallback(payload: unknown): Promise<StandardStatusResult> {
    this.logger.log(`Parsing ANI SIM Webhook Callback payload`);

    const standardPayload = payload as StandardWebhookPayload;

    // Hỗ trợ cả 2 định dạng: payload chuẩn Template hoặc payload trực tiếp từ ANI SIM
    if (
      standardPayload.status === 'COMPLETED' ||
      standardPayload.status === 'FAILED'
    ) {
      return Promise.resolve({
        supplierTransId: String(
          standardPayload.supplierTransId ||
            standardPayload.data?.supplierTransId ||
            '',
        ),
        requestId: standardPayload.requestId,
        status: standardPayload.status,
        costAmount: standardPayload.data?.costAmount,
        msisdn: standardPayload.data?.phone || standardPayload.data?.msisdn,
        serial: standardPayload.data?.serial,
        lpaString: standardPayload.data?.lpa,
        qrUrl: standardPayload.data?.urlLpa,
        errorCode: standardPayload.error?.code,
        errorMessage: standardPayload.error?.message,
        rawResponse: payload,
      });
    }

    // Payload gốc từ ANI SIM:
    const anisimPayload = payload as AnisimApiResponse<AnisimOrderData> &
      AnisimOrderData;
    const data: AnisimOrderData = anisimPayload.data || anisimPayload;
    const supplierTransId = String(data.id || data.orderId || '');
    const requestId = data.requestId;

    return Promise.resolve(
      this.mapAnisimItemToStatusResult(data, supplierTransId, requestId),
    );
  }

  /**
   * Ánh xạ trạng thái số của ANI SIM sang Universal Status Enum:
   * 1: PENDING -> PROCESSING
   * 2: PROCESSING -> PROCESSING
   * 3: REGISTERED -> PROCESSING (chờ QR eSIM)
   * 4: COMPLETED -> COMPLETED
   * 5: FAILED -> FAILED
   * 6: CANCELLED -> CANCELLED
   */
  private mapAnisimItemToStatusResult(
    item: AnisimOrderData,
    supplierTransId: string,
    requestId?: string,
  ): StandardStatusResult {
    const rawStatus = Number(item.status);
    let mappedStatus: StandardStatusResult['status'] = 'PROCESSING';

    if (rawStatus === 4) {
      mappedStatus = 'COMPLETED';
    } else if (rawStatus === 5) {
      mappedStatus = 'FAILED';
    } else if (rawStatus === 6) {
      mappedStatus = 'CANCELLED';
    } else if (rawStatus === 1 || rawStatus === 2 || rawStatus === 3) {
      mappedStatus = 'PROCESSING';
    }

    return {
      supplierTransId: String(item.id || supplierTransId),
      requestId: item.requestId || requestId,
      status: mappedStatus,
      completedAt:
        item.completedAt ||
        (mappedStatus === 'COMPLETED' ? new Date().toISOString() : undefined),
      costAmount: item.costPrice || item.costAmount,
      msisdn: item.msisdn || item.phone,
      serial: item.serial,
      lpaString: item.lpa || item.lpaString,
      qrUrl: item.urlLpa || item.qrUrl,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage || item.reason,
      rawResponse: item,
    };
  }
}
