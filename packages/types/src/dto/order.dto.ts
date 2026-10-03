export type OrderStatus =
  | "CREATED"
  | "PAID"
  | "PREPARING"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentStatus = "UNPAID" | "PAID";

export interface OrderItemDTO {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  options?: string;
}

export interface OrderDTO {
  id: string;
  tableId: string;
  tableNumber: string;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  ecpayTradeNo?: string;
  items: OrderItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  options?: string;
}

export interface CreateOrderInput {
  tableNumber: string;
  items: CreateOrderItemInput[];
}
