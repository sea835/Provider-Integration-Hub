import { TransactionService } from './transaction.service';
import { TransactionRepositoryPort } from '../domain/transaction.repository.port';
import { ProviderAdapterRegistry } from '@modules/provider-adapter/application/provider-adapter.registry';
import { CatalogService } from '@modules/catalog/application/catalog.service';
import { TransactionEntity } from '../domain/transaction.entity';
import { CreateOrderDto } from '../presentation/dto/create-order.dto';

describe('TransactionService', () => {
  let service: TransactionService;
  let mockRepo: Record<string, jest.Mock>;
  let mockRegistry: Record<string, jest.Mock>;
  let mockCatalog: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRepo = {
      findByPartnerTransId: jest.fn(),
      findByTransCode: jest.fn(),
      findBySupplierTransId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findPaginated: jest.fn(),
      delete: jest.fn(),
    };

    mockRegistry = {
      get: jest.fn(),
      register: jest.fn(),
      has: jest.fn(),
    };

    mockCatalog = {
      getPackageBySku: jest.fn(),
      getPackages: jest.fn(),
      checkEligibility: jest.fn(),
      syncPackagesFromAnisim: jest.fn(),
    };

    service = new TransactionService(
      mockRepo as unknown as TransactionRepositoryPort,
      mockRegistry as unknown as ProviderAdapterRegistry,
      mockCatalog as unknown as CatalogService,
    );
  });

  describe('createOrder (Store API Bước 3)', () => {
    it('should create order, call ANI SIM adapter, and return PROCESSING transaction', async () => {
      mockRepo.findByPartnerTransId.mockResolvedValue(null);

      mockCatalog.getPackageBySku.mockReturnValue({
        sku: 'SM110',
        name: 'SM110',
        telco: 'VINAPHONE',
        price: 110000,
        costPrice: 95000,
        cycleDays: 30,
        dataGbPerDay: 7,
        canActivate: true,
        canTopup: true,
        status: 'ACTIVE',
        providerCode: 'ANISIM',
        supplierPackageId: '87196a70-196c-48cc-9a00-02a8667d9bba',
      });

      const initialTx: TransactionEntity = {
        id: 'tx-uuid-1',
        transCode: 'TX_20260928_ABC12',
        partnerTransId: 'REQ_001',
        providerCode: 'ANISIM',
        packageCode: 'SM110',
        action: 'ACTIVATE_SIM',
        targetPhone: '0914780285',
        serial: '8984012601500769003',
        amount: 110000,
        costAmount: 95000,
        status: 'PROCESSING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.create.mockResolvedValue(initialTx);

      const mockAdapter = {
        providerCode: 'ANISIM',
        createOrder: jest.fn().mockResolvedValue({
          supplierTransId: 'ord_ani_7788',
          status: 'PROCESSING',
          suggestedPollDelaySec: 5,
        }),
      };
      mockRegistry.get.mockReturnValue(mockAdapter);

      const updatedTx: TransactionEntity = {
        ...initialTx,
        supplierTransId: 'ord_ani_7788',
      };
      mockRepo.update.mockResolvedValue(updatedTx);

      const dto: CreateOrderDto = {
        requestId: 'REQ_001',
        action: 'ACTIVATE_SIM',
        phone: '0914780285',
        packageCode: 'SM110',
        serial: '8984012601500769003',
      };

      const result = await service.createOrder(dto);

      expect(mockRepo.findByPartnerTransId).toHaveBeenCalledWith('REQ_001');
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockAdapter.createOrder).toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalled();
      expect(result.requestId).toBe('REQ_001');
      expect(result.supplierTransId).toBe('ord_ani_7788');
      expect(result.status).toBe('PROCESSING');
    });

    it('should return existing transaction when duplicate requestId is provided (Idempotency)', async () => {
      const existingTx: TransactionEntity = {
        id: 'tx-uuid-old',
        transCode: 'TX_20260928_EXISTING',
        partnerTransId: 'REQ_001',
        providerCode: 'ANISIM',
        packageCode: 'SM110',
        action: 'ACTIVATE_SIM',
        amount: 110000,
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.findByPartnerTransId.mockResolvedValue(existingTx);

      const dto: CreateOrderDto = {
        requestId: 'REQ_001',
        action: 'ACTIVATE_SIM',
        packageCode: 'SM110',
      };

      const result = await service.createOrder(dto);

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(result.transCode).toBe('TX_20260928_EXISTING');
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('handleWebhookResult (Bước 4A)', () => {
    it('should update transaction to COMPLETED with LPA and QR URL', async () => {
      const existingTx: TransactionEntity = {
        id: 'tx-uuid-1',
        transCode: 'TX_20260928_ABC12',
        partnerTransId: 'REQ_001',
        supplierTransId: 'ord_ani_7788',
        providerCode: 'ANISIM',
        packageCode: 'SM110',
        action: 'ACTIVATE_SIM',
        amount: 110000,
        status: 'PROCESSING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.findBySupplierTransId.mockResolvedValue(existingTx);
      mockRepo.update.mockImplementation(
        (id: string, data: Record<string, unknown>) =>
          Promise.resolve({ ...existingTx, ...data }),
      );

      const updated = await service.handleWebhookResult({
        supplierTransId: 'ord_ani_7788',
        requestId: 'REQ_001',
        status: 'COMPLETED',
        costAmount: 95000,
        msisdn: '0914780285',
        serial: '8984012601500769003',
        lpaString: 'LPA:1$smdp.example.com$CONFIRM_CODE',
        qrUrl: 'https://qr.example.com/esim.png',
      });

      expect(mockRepo.update).toHaveBeenCalledWith(
        'tx-uuid-1',
        expect.objectContaining({
          status: 'COMPLETED',
          costAmount: 95000,
          targetPhone: '0914780285',
          lpaString: 'LPA:1$smdp.example.com$CONFIRM_CODE',
          qrUrl: 'https://qr.example.com/esim.png',
        }),
      );
      expect(updated?.status).toBe('COMPLETED');
    });
  });
});
