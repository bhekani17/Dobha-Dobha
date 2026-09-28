/**
 * DOBHA DOBHA — Root React Native Application
 * Johannesburg Local Street Marketplace (Android & iOS)
 */
// Polyfill URL setters for Hermes/React Native environments where protocol has only a getter
if (typeof URL !== 'undefined') {
  try {
    const proto = URL.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'protocol');
    if (desc && !desc.set) {
      Object.defineProperty(proto, 'protocol', {
        get: desc.get,
        set: function (val) {
          try {
            const p = val.endsWith(':') ? val : `${val}:`;
            this._url = (this._url || this.href || '').replace(/^([a-zA-Z][a-zA-Z\d+\-.]*:)?\/\//, `${p}//`);
          } catch (_) {}
        },
        configurable: true,
      });
    }
  } catch (_) {}
}

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';

import { registerRootComponent } from 'expo';

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <StatusBar style="light" backgroundColor="#0a0d14" />
        <AppNavigator />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

registerRootComponent(App);
