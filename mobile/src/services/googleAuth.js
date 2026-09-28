/**
 * DOBHA DOBHA — Google OAuth Authentication
 * Integrates Google Sign-In with backend authentication
 */

import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import ApiService from './api';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth configuration
// Configure these in your Google Cloud Console
const GOOGLE_CLIENT_ID = Platform.select({
  android: process.env.EXPO_PUBLIC_ANDROID_GOOGLE_CLIENT_ID || 'YOUR_ANDROID_GOOGLE_CLIENT_ID',
  ios: process.env.EXPO_PUBLIC_IOS_GOOGLE_CLIENT_ID || 'YOUR_IOS_GOOGLE_CLIENT_ID',
  web: process.env.EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID || 'YOUR_WEB_GOOGLE_CLIENT_ID'
});

// Discovery document for Google OAuth
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke'
};

export const GoogleAuthService = {
  /**
   * Initiate Google Sign-In flow
   */
  async signInWithGoogle() {
    try {
      // Create the OAuth request
      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_CLIENT_ID,
        scopes: ['openid', 'profile', 'email'],
        redirectUri: AuthSession.makeRedirectUri({
          scheme: 'sky-local-trade',
          path: 'auth'
        }),
        usePKCE: true,
        extraParams: {
          prompt: 'select_account'
        }
      });

      // Show the Google auth page
      const result = await request.promptAsync(discovery);

      if (result.type === 'success') {
        // Exchange the authorization code with our backend
        return await this.exchangeCodeWithBackend(result.params.code);
      } else {
        throw new Error('Google authentication was cancelled');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  },

  /**
   * Exchange authorization code with our backend
   */
  async exchangeCodeWithBackend(code) {
    try {
      const result = await ApiService.googleAuthCallback(code);
      return result;
    } catch (error) {
      console.error('Backend auth exchange error:', error);
      throw error;
    }
  },

  /**
   * Sign out from Google (if needed for cleanup)
   */
  async signOut() {
    // Backend handles session invalidation
    return true;
  }
};

export default GoogleAuthService;