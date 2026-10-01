export interface SupplierChangedEvent {
  code: string;
  version: number;
}

/** Phát / nhận sự kiện cấu hình NCC thay đổi giữa các process (API, worker). */
export abstract class SupplierEventsPort {
  abstract publishChanged(event: SupplierChangedEvent): Promise<void>;
  abstract onChanged(handler: (event: SupplierChangedEvent) => void): void;
}
