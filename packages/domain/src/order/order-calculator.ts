export interface OrderLineItem {
  unitPrice: number;
  quantity: number;
}

export interface CalculateOrderTotalOptions {
  discountRate?: number;
}

export interface OrderTotalResult {
  subTotal: number;
  discountAmount: number;
  total: number;
}

export class OrderCalculator {
    static calculate(
        items: OrderLineItem[],
        options: CalculateOrderTotalOptions = {}
    ): OrderTotalResult {
        const { discountRate } = options;

        const subTotal = items.reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0
        );

        const discountAmount =
            discountRate !== undefined
                ? Math.round(subTotal * (1 - discountRate / 10))
                : 0;
        const total = subTotal - discountAmount;

        return {
            subTotal,
            discountAmount,
            total,
        };
    }
}
