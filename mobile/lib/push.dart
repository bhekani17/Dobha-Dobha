import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'api.dart';

/// Push notifications (Firebase Cloud Messaging) on Android and iOS.
///
/// Needs the Firebase config files (android/app/google-services.json, ios/Runner/GoogleService-Info.plist).
/// Without them [start] quietly does nothing and the app keeps polling for news while open.
class Push {
  static bool _ready = false;
  static String? _token;
  static StreamSubscription<String>? _refresh;
  static StreamSubscription<RemoteMessage>? _foreground;
  static StreamSubscription<RemoteMessage>? _opened;

  /// After signing in: ask permission, register this phone with the server, and listen.
  /// [onMessage] runs when a push arrives while the app is open; [onOpen] when one is tapped.
  static Future<void> start(
    Api api, {
    required VoidCallback onMessage,
    required void Function(Map<String, dynamic> data) onOpen,
  }) async {
    if (kIsWeb) return;
    try {
      if (!_ready) {
        await Firebase.initializeApp();
        _ready = true;
      }
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      // Listen first, so a failed registration below never loses the push the app was opened from.
      await _foreground?.cancel();
      _foreground = FirebaseMessaging.onMessage.listen((_) => onMessage());
      await _opened?.cancel();
      _opened = FirebaseMessaging.onMessageOpenedApp.listen((m) => onOpen(m.data));
      // Tapped while the app was closed.
      final initial = await messaging.getInitialMessage();
      if (initial != null) onOpen(initial.data);

      await _refresh?.cancel();
      _refresh = messaging.onTokenRefresh.listen((t) {
        _token = t;
        _register(api, t).catchError((_) {});
      });
      _token = await messaging.getToken();
      if (_token != null) await _register(api, _token!);
    } catch (e) {
      // No Firebase config yet, or Google Play services missing: carry on without push.
      debugPrint('Push notifications unavailable: $e');
    }
  }

  /// Before logging out: stop sending this account's pushes to this phone.
  static Future<void> stop(Api api) async {
    await _refresh?.cancel();
    await _foreground?.cancel();
    await _opened?.cancel();
    _refresh = _foreground = _opened = null;
    final token = _token;
    _token = null;
    if (token == null) return;
    try {
      await api.delete('/api/me/devices', {'token': token});
    } catch (_) {
      // Signing out locally is what matters; the server drops dead tokens on its own.
    }
  }

  static Future<void> _register(Api api, String token) =>
      api.post('/api/me/devices', {'token': token, 'platform': defaultTargetPlatform.name});
}
