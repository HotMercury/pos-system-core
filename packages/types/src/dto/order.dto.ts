export type OrderStatus =
  | "CREATED"
  | "PAID"
  | "PREPARING"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentStatus = "UNPAID" | "PAID";
export type OrderType = "DINE_IN" | "TAKEAWAY";
export type CustomerSegment = "GENERAL" | "MEDICAL";

export interface OrderItemDTO {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantSize?: "M" | "L";
  variantTemperature?: "H" | "I";
  variantFlavor?: string;
  quantity: number;
  price: number;
  options?: string;
}

export interface OrderDTO {
  id: string;
  orderType: OrderType;
  tableId?: string;
  tableNumber?: string;
  pickupCode?: string;
  promotionCode?: string;
  customerSegment: CustomerSegment;
  subtotalAmount: number;
  discountAmount: number;
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
  variantId: string;
  quantity: number;
  options?: string;
}

export interface CreateOrderInput {
  orderType: OrderType;
  tableNumber?: string;
  promoCode?: string;
  items: CreateOrderItemInput[];
}
