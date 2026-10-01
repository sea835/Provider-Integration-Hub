export const OrderAction = {
  BUY_DATA: 'BUY_DATA',
  TOPUP: 'TOPUP',
  ACTIVATE_SIM: 'ACTIVATE_SIM',
  CANCEL_PACKAGE: 'CANCEL_PACKAGE',
} as const;

export type OrderActionType = (typeof OrderAction)[keyof typeof OrderAction];

export const ORDER_ACTION_VALUES = Object.values(OrderAction);
