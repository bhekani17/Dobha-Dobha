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
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'sky-local-trade',
        path: 'auth'
      });

      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_CLIENT_ID,
        scopes: ['openid', 'profile', 'email'],
        redirectUri,
        usePKCE: true,
        extraParams: { prompt: 'select_account' }
      });

      const result = await request.promptAsync(discovery);

      if (result.type !== 'success') {
        throw new Error('Google authentication was cancelled');
      }

      // Exchange the auth code for tokens at Google's token endpoint
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: GOOGLE_CLIENT_ID,
          code: result.params.code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier }
        },
        { tokenEndpoint: discovery.tokenEndpoint }
      );

      // Fetch user profile from Google using the access token
      const userInfoResponse = await AuthSession.fetchUserInfoAsync(
        tokenResponse,
        { userInfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo' }
      );

      // Send resolved user info to our backend (not the raw code)
      return await ApiService.googleAuthCallback({
        email: userInfoResponse.email,
        name: userInfoResponse.name,
        googleId: userInfoResponse.sub
      });
    } catch (error) {
      console.error('Google sign-in error:', error);
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