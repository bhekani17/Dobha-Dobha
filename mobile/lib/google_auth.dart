import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'api.dart';
import 'state/app_state.dart';

/// "Continue with Google". Client ids from the Google Cloud console go in
/// config/google.json, passed to builds with --dart-define-from-file=config/google.json.
/// GOOGLE_WEB_CLIENT_ID is used on every platform; GOOGLE_IOS_CLIENT_ID only on iOS.
/// Without GOOGLE_WEB_CLIENT_ID the Google button is hidden.
class GoogleAuth {
  static const webClientId = String.fromEnvironment('GOOGLE_WEB_CLIENT_ID');
  static const iosClientId = String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');

  static bool get enabled => webClientId.isNotEmpty;

  static Future<void>? _init;
  static final _errors = StreamController<String>.broadcast();
  static final busy = ValueNotifier(false);

  /// Messages to show when Google sign-in fails.
  static Stream<String> get errors => _errors.stream;

  /// Idempotent. Every successful Google sign-in (the phone flow or the web
  /// button) arrives on the events stream and is exchanged for a Dobha session.
  static Future<void> ensureInitialized() {
    return _init ??= () async {
      final isIos = !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;
      await GoogleSignIn.instance.initialize(
        clientId: kIsWeb ? webClientId : (isIos && iosClientId.isNotEmpty ? iosClientId : null),
        // Makes Android and iOS mint ID tokens for the web client, which the server accepts.
        serverClientId: kIsWeb ? null : webClientId,
      );
      GoogleSignIn.instance.authenticationEvents.listen(_onEvent, onError: _onError);
    }();
  }

  static Future<void> _onEvent(GoogleSignInAuthenticationEvent event) async {
    if (event is! GoogleSignInAuthenticationEventSignIn) return;
    final idToken = event.user.authentication.idToken;
    if (idToken == null) {
      _errors.add('Google did not return an ID token. Check the client ids.');
      return;
    }
    busy.value = true;
    try {
      await AppState().loginWithGoogle(idToken);
    } on ApiException catch (e) {
      _errors.add(e.message);
      await GoogleSignIn.instance.signOut();
    } finally {
      busy.value = false;
    }
  }

  static void _onError(Object e) {
    if (e is GoogleSignInException && e.code == GoogleSignInExceptionCode.canceled) return;
    _errors.add('Google sign-in failed. Please try again.');
  }

  /// Phone flow. On web, Google's own rendered button is used instead.
  static Future<void> signIn() async {
    await ensureInitialized();
    try {
      await GoogleSignIn.instance.authenticate();
    } catch (e) {
      _onError(e);
    }
  }

  static Future<void> signOut() async {
    if (!enabled || _init == null) return;
    try {
      await GoogleSignIn.instance.signOut();
    } catch (_) {}
  }
}
