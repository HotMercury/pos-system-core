export * from "./order.events";

export enum SocketEvent {
  NewOrder = "order:new",
  OrderStatusChanged = "order:status_changed",
  OrderPaid = "order:paid",
}
