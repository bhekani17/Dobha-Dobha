/**
 * DOBHA DOBHA — User Profile Store (React Native)
 * Central reactive store for real authenticated user data & session
 */

import ApiService from './api';

let currentProfile = null;
let currentToken = null;
let listeners = [];
let itemListeners = [];

export const UserStore = {
  isAuthenticated() {
    return !!currentProfile && !!currentToken;
  },

  getProfile() {
    return currentProfile ? { ...currentProfile } : null;
  },

  getToken() {
    return currentToken;
  },

  async restoreSession() {
    const user = await ApiService.restoreSession();
    if (!user) return null;
    return this.setAuth(user, ApiService.getToken());
  },

  setAuth(user, token) {
    currentProfile = {
      id: user.id,
      name: user.name,
      displayName: user.name,
      fullName: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role || 'buyer',
      location: user.location || 'Johannesburg CBD',
      locationHub: user.location || 'Safe Trade Hub',
      avatar: user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      isKycVerified: user.verification_status === 'verified',
      escrowBalance: user.wallet_balance ? Number(user.wallet_balance).toFixed(2) : '0.00'
    };
    currentToken = token;
    ApiService.setToken(token);
    this.notify();
    return { ...currentProfile };
  },

  updateProfile(updates) {
    if (!currentProfile) return null;
    currentProfile = { ...currentProfile, ...updates };
    this.notify();
    return { ...currentProfile };
  },

  logout() {
    currentProfile = null;
    currentToken = null;
    ApiService.setToken(null);
    ApiService.clearSession();
    this.notify();
  },

  notify() {
    listeners.forEach((fn) => {
      try {
        fn(currentProfile ? { ...currentProfile } : null);
      } catch (err) {
        console.warn('UserStore listener error', err);
      }
    });
  },

  subscribe(listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  notifyItemUploaded(item) {
    itemListeners.forEach((fn) => {
      try {
        fn(item);
      } catch (err) {
        console.warn('Item listener error', err);
      }
    });
  },

  subscribeItemUploaded(listener) {
    itemListeners.push(listener);
    return () => {
      itemListeners = itemListeners.filter((l) => l !== listener);
    };
  }
};

export default UserStore;
