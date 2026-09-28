/**
 * DOBHA DOBHA — Escrow Orders Store (React Native)
 * Real-time order sync with live AWS backend
 */

import ApiService from './api';

let orders = [];
let listeners = [];

export const OrderStore = {
  getOrders() {
    return [...orders];
  },

  async fetchLiveOrders(userId) {
    const res = await ApiService.getEscrowOrders(userId);
    if (res.success && Array.isArray(res.orders)) {
      orders = res.orders;
      this.notify();
    }
    return [...orders];
  },

  addOrder(order) {
    orders = [order, ...orders];
    this.notify();
    return order;
  },

  completeOrder(token) {
    let updatedOrder = null;
    orders = orders.map((o) => {
      const orderToken = o.pickupToken || o.pickup_token;
      if (orderToken && orderToken.toUpperCase() === token.trim().toUpperCase()) {
        updatedOrder = { ...o, status: 'COMPLETED' };
        return updatedOrder;
      }
      return o;
    });
    this.notify();
    return updatedOrder;
  },

  notify() {
    listeners.forEach((fn) => {
      try {
        fn([...orders]);
      } catch (_) {}
    });
  },

  subscribe(listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }
};

export default OrderStore;
