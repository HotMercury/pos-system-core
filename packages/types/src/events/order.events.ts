import type { OrderDTO } from "../dto/order.dto";

export interface NewOrderPayload {
  order: OrderDTO;
}

export interface OrderStatusChangedPayload {
  orderId: string;
  status: OrderDTO["status"];
}

export interface OrderPaidPayload {
  orderId: string;
  paymentMethod: string;
}
