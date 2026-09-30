import { AnisimAdapter } from './anisim.adapter';
import { UniversalOrderDto } from '../../domain/dtos/universal-order.dto';

describe('AnisimAdapter', () => {
  let adapter: AnisimAdapter;

  beforeEach(() => {
    adapter = new AnisimAdapter();
  });

  describe('checkEligibility', () => {
    it('should return eligible true when package is active and canActivate is true', async () => {
      const result = await adapter.checkEligibility('0914780285', 'SM110', {
        packagePlan: {
          id: '87196a70-196c-48cc-9a00-02a8667d9bba',
          code: 'SM110',
          name: 'SM110',
          cycleDays: 30,
          dataGbPerDay: 7,
          canActivate: true,
          canTopup: true,
          status: 1,
        },
      });

      expect(result.isEligible).toBe(true);
    });

    it('should return eligible false when package is inactive', async () => {
      const result = await adapter.checkEligibility('0914780285', 'SM110', {
        packagePlan: {
          id: 'test-id',
          code: 'SM110',
          canActivate: false,
          status: 0,
        },
      });

      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('inactive or cannot be activated');
    });
  });

  describe('createOrder', () => {
    it('should call ANI SIM endpoint and map response to PROCESSING', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 0,
            message: 'Order created',
            data: {
              id: 'ord_ani_12345',
              code: 'ANI_ORD_001',
              status: 1,
            },
          }),
      });
      global.fetch = mockFetch;

      const orderDto: UniversalOrderDto = {
        requestId: 'REQ_TEST_001',
        action: 'ACTIVATE_SIM',
        packageCode: 'SM110',
        serial: '8984012601500769003',
      };

      const result = await adapter.createOrder(orderDto, {
        packagePlanId: '87196a70-196c-48cc-9a00-02a8667d9bba',
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(result.status).toBe('PROCESSING');
      expect(result.supplierTransId).toBe('ord_ani_12345');
      expect(result.suggestedPollDelaySec).toBe(5);
    });
  });

  describe('parseWebhookCallback', () => {
    it('should parse ANI SIM webhook callback with status 4 as COMPLETED and extract eSIM info', async () => {
      const rawPayload = {
        code: 0,
        data: {
          id: 'ord_ani_12345',
          requestId: 'REQ_TEST_001',
          status: 4,
          msisdn: '0914780285',
          serial: '8984012601500769003',
          lpa: 'LPA:1$smdp.example.com$MATCHING_ID',
          urlLpa: 'https://qr.example.com/esim.png',
          costPrice: 95000,
        },
      };

      const result = await adapter.parseWebhookCallback(rawPayload);

      expect(result.status).toBe('COMPLETED');
      expect(result.supplierTransId).toBe('ord_ani_12345');
      expect(result.requestId).toBe('REQ_TEST_001');
      expect(result.msisdn).toBe('0914780285');
      expect(result.serial).toBe('8984012601500769003');
      expect(result.lpaString).toBe('LPA:1$smdp.example.com$MATCHING_ID');
      expect(result.qrUrl).toBe('https://qr.example.com/esim.png');
      expect(result.costAmount).toBe(95000);
    });
  });
});
