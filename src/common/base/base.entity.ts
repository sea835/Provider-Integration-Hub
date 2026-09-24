export abstract class BaseEntity {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  metadata?: Record<string, any> | null;
}
