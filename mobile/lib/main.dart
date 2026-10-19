import 'package:flutter/material.dart';

import 'screens/auth_screens.dart';
import 'screens/chat_screens.dart';
import 'screens/main_shell.dart';
import 'screens/notifications_screen.dart';
import 'state/app_state.dart';
import 'theme.dart';

void main() {
  final binding = WidgetsFlutterBinding.ensureInitialized();
  DobhaColors.isDark = binding.platformDispatcher.platformBrightness == Brightness.dark;
  // Firebase is only for push on phones, so it starts there (Push.start), never holding up the app.
  runApp(const DobhaLiveApp());
}

/// Follows the phone's light/dark setting.
class DobhaLiveApp extends StatefulWidget {
  const DobhaLiveApp({super.key});

  @override
  State<DobhaLiveApp> createState() => _DobhaLiveAppState();
}

class _DobhaLiveAppState extends State<DobhaLiveApp> with WidgetsBindingObserver {
  final _light = dobhaTheme(Brightness.light);
  final _dark = dobhaTheme(Brightness.dark);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Catch up on sales and dispatches that happened while the app was in the background.
    if (state == AppLifecycleState.resumed) AppState().pollNotifications();
  }

  @override
  void didChangePlatformBrightness() {
    final dark = WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark;
    if (dark == DobhaColors.isDark) return;
    DobhaColors.isDark = dark;
    // Screens read DobhaColors directly, so rebuild everything in place (routes and state are kept).
    void rebuild(Element e) {
      e.markNeedsBuild();
      e.visitChildren(rebuild);
    }

    (context as Element).visitChildren(rebuild);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Dobha Dobha',
      debugShowCheckedModeBanner: false,
      theme: _light,
      darkTheme: _dark,
      themeMode: DobhaColors.isDark ? ThemeMode.dark : ThemeMode.light,
      home: const AuthGate(),
    );
  }
}

/// Splash while the saved session is restored, then the welcome flow or the app.
/// Logging out (or an expired session) drops back to the welcome screen.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _splashDone = false;
  bool _wasLoggedIn = false;

  @override
  void initState() {
    super.initState();
    AppState().onPushTap = _openPush;
    // Keep the splash up long enough to register, even when restoring is instant.
    Future.wait([
      AppState().restoreSession(),
      Future.delayed(const Duration(milliseconds: 1400)),
    ]).then((_) {
      if (mounted) setState(() => _splashDone = true);
    });
  }

  /// A tapped push notification: chat messages open the inbox, everything else the notifications list.
  void _openPush(Map<String, dynamic> data) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !AppState().isLoggedIn) return;
      AppState().pollNotifications();
      if (data['kind'] == 'message') {
        ChatsScreen.open(context);
      } else {
        NotificationsScreen.open(context);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final state = AppState();
        // Signing in (including from Google's callback) closes any open login/register screens.
        // Signing out (or deleting the account) from a pushed screen like Settings closes it too.
        if (state.isLoggedIn != _wasLoggedIn) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
          });
        }
        _wasLoggedIn = state.isLoggedIn;
        final Widget child;
        if (!_splashDone || !state.restored) {
          child = const SplashScreen(key: ValueKey('splash'));
        } else if (!state.isLoggedIn) {
          child = const WelcomeScreen(key: ValueKey('welcome'));
        } else {
          child = const MainShell(key: ValueKey('app'));
        }
        return AnimatedSwitcher(duration: const Duration(milliseconds: 400), child: child);
      },
    );
  }
}
