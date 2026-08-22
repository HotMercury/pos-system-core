export interface PaymentRequest {
  orderId: string;
  amount: number;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  failureReason?: string;
}

export interface PaymentStrategy {
  pay(request: PaymentRequest): Promise<PaymentResult>;
}
