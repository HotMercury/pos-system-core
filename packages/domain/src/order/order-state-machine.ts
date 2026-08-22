import { InvalidStateTransitionError } from "./errors";

export type OrderStatus =
  | "CREATED"
  | "PAID"
  | "PREPARING"
  | "COMPLETED"
  | "CANCELLED";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ["PAID", "CANCELLED"],
  PAID: ["PREPARING", "CANCELLED"],
  PREPARING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export class OrderStateMachine {
    static canTransition(from: OrderStatus, to: OrderStatus): boolean {
        return ALLOWED_TRANSITIONS[from].includes(to);
    }

    static transition(from: OrderStatus, to: OrderStatus): OrderStatus {
        if (!this.canTransition(from, to)) {
            throw new InvalidStateTransitionError(from, to);
        }
        return to;
    }
}
