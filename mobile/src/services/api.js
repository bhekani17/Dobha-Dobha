/**
 * DOBHA DOBHA — API Client for Node.js Backend & PostgreSQL RDS
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Configure EXPO_PUBLIC_API_URL per environment; localhost is only for local development.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'web' ? 'http://localhost:3000' : 'http://192.168.1.19:3000');

export const LOGO_DEV_KEY = 'pk_YATscD2-Rx6ItVMsD1ElFw';

export const DEFAULT_ITEM_IMAGE =
  'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80';

export function resolveImageUrl(url, fallback) {
  const fallbackUrl = fallback || DEFAULT_ITEM_IMAGE;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return fallbackUrl;
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `${API_BASE_URL}${trimmed}`;
  }
  return `${API_BASE_URL}/${trimmed}`;
}

export function getBrandLogoUrl(domain, size = 60) {
  if (!domain) return '';
  return `https://img.logo.dev/${domain}?token=${LOGO_DEV_KEY}&size=${size}&format=png`;
}

const isWeb = Platform.OS === 'web';

const safeStorage = {
  async setItem(key, val) {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, val);
        }
      } catch (_) {}
      return;
    }
    try {
      await SecureStore.setItemAsync(key, val);
    } catch (e) {
      console.warn('SecureStore setItem error:', e?.message);
    }
  },
  async getItem(key) {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch (_) {}
      return null;
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn('SecureStore getItem error:', e?.message);
      return null;
    }
  },
  async deleteItem(key) {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch (_) {}
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn('SecureStore deleteItem error:', e?.message);
    }
  }
};

let authToken = null;
let refreshToken = null;

export const ApiService = {
  setToken(token) {
    authToken = token;
  },

  async saveSession(token, nextRefreshToken) {
    authToken = token || null;
    refreshToken = nextRefreshToken || null;
    if (authToken) await safeStorage.setItem('dobha_access_token', authToken);
    if (refreshToken) await safeStorage.setItem('dobha_refresh_token', refreshToken);
  },

  async clearSession() {
    authToken = null;
    refreshToken = null;
    await safeStorage.deleteItem('dobha_access_token');
    await safeStorage.deleteItem('dobha_refresh_token');
  },

  async restoreSession() {
    const storedRefreshToken = await safeStorage.getItem('dobha_refresh_token');
    const storedAccessToken = await safeStorage.getItem('dobha_access_token');

    if (storedAccessToken) {
      authToken = storedAccessToken;
      const profile = await this.getProfile();
      if (profile?.success && profile.user) {
        return profile.user;
      }
    }

    if (!storedRefreshToken) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefreshToken })
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        await this.clearSession();
        return null;
      }

      authToken = data.token;
      refreshToken = storedRefreshToken;
      await safeStorage.setItem('dobha_access_token', authToken);
      const profile = await this.getProfile();
      return profile?.success ? profile.user : null;
    } catch (err) {
      console.warn('Restore session error:', err);
      return null;
    }
  },

  getToken() {
    return authToken;
  },

  async getHealth() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`);
      return await res.json();
    } catch (err) {
      console.warn('API getHealth error:', err.message);
      return { status: 'offline' };
    }
  },

  // Auth: Register new user
  async register(userData) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (res.ok && data.token) {
        await this.saveSession(data.token, data.refreshToken);
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message || 'Network error connecting to server' };
    }
  },

  // Auth: Login user
  async login(credentials) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await res.json();
      if (res.ok && data.token) {
        await this.saveSession(data.token, data.refreshToken);
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message || 'Network error connecting to server' };
    }
  },

  // Auth: Google OAuth callback — receives resolved { email, name, googleId }
  async googleAuthCallback({ email, name, googleId }) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, googleId })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        await this.saveSession(data.token, data.refreshToken);
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message || 'Google authentication failed' };
    }
  },

  // Profile
  async getProfile() {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/users/profile`, { headers });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // Catalog & Items
  async getItems(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      const url = query ? `${API_BASE_URL}/api/items?${query}` : `${API_BASE_URL}/api/items`;
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      return { success: false, items: [] };
    }
  },

  async getUserItems(sellerId) {
    try {
      const url = sellerId
        ? `${API_BASE_URL}/api/items?seller_id=${encodeURIComponent(sellerId)}&status=all`
        : `${API_BASE_URL}/api/items`;
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      return { success: false, items: [] };
    }
  },

  async createItem(itemData) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify(itemData)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // Media Upload: Image / Video / Document
  async uploadMedia({ base64, folder = 'images', fileName, contentType }) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/upload/${folder === 'videos' ? 'video' : folder === 'documents' ? 'document' : 'image'}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          base64,
          fileName,
          contentType
        })
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message || 'Upload network error' };
    }
  },

  // Messaging & Negotiations
  async getConversations() {
    try {
      const headers = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/messages`, { headers });
      return await res.json();
    } catch (err) {
      return { success: false, conversations: [] };
    }
  },

  async getMessages(otherUserId) {
    try {
      const headers = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/messages/thread/${otherUserId}`, { headers });
      return await res.json();
    } catch (err) {
      return { success: false, messages: [] };
    }
  },

  async sendMessage({ receiverId, itemId, content }) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/messages/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          receiver_id: receiverId,
          item_id: itemId,
          content
        })
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // KYC Identity Verification
  async submitKyc({ documentType, idNumber, fullName, photoUrl }) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const payload = {
        documentType,
        document_type: documentType,
        idNumber,
        id_number: idNumber,
        fullName,
        photoUrl,
        photo_url: photoUrl,
        documentUrl: photoUrl,
        document_url: photoUrl
      };
      let res = await fetch(`${API_BASE_URL}/api/users/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (res.status === 404) {
        res = await fetch(`${API_BASE_URL}/api/users/kyc`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      }
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // Live Streams
  async getStreams() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/streams`);
      return await res.json();
    } catch (err) {
      return { success: false, streams: [] };
    }
  },

  async startStream({ title, location, playbackUrl, posterUrl, featuredItem, sellerName, sellerId, sellerAvatar }) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/streams/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          location,
          playback_url: playbackUrl,
          poster_url: posterUrl,
          featured_item: featuredItem,
          seller_name: sellerName,
          seller_id: sellerId,
          seller_avatar: sellerAvatar
        })
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async endStream(streamId) {
    try {
      const headers = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/streams/${streamId}/end`, {
        method: 'POST',
        headers
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async dropItemToStream(streamId, itemData) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/streams/${streamId}/drop`, {
        method: 'POST',
        headers,
        body: JSON.stringify(itemData)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async sendStreamChat(streamId, { user, text, reaction }) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/streams/${streamId}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user, text, reaction })
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async claimDibs(streamId, itemId, buyer) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/streams/${streamId}/dibs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ itemId, buyer_id: buyer, buyer })
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // Escrow Orders
  async createEscrowOrder(orderData) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/escrow/order`, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderData)
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getEscrowOrders(userId) {
    try {
      const url = userId
        ? `${API_BASE_URL}/api/escrow/orders?user_id=${encodeURIComponent(userId)}`
        : `${API_BASE_URL}/api/escrow/orders`;
      const headers = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(url, { headers });
      return await res.json();
    } catch (err) {
      return { success: false, orders: [] };
    }
  },

  async verifyPickup(token) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE_URL}/api/escrow/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ token, pickup_token: token })
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

export default ApiService;
