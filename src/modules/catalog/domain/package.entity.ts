export interface PackagePlanEntity {
  sku: string;
  name: string;
  telco: string;
  price: number;
  costPrice: number;
  cycleDays: number;
  dataGbPerDay: number;
  canActivate: boolean;
  canTopup: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  providerCode: string;
  supplierPackageId: string;
}
