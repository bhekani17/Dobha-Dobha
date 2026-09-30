import 'package:flutter/material.dart';

import 'screens/auth_screens.dart';
import 'screens/main_shell.dart';
import 'state/app_state.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const DobhaLiveApp());
}

class DobhaLiveApp extends StatelessWidget {
  const DobhaLiveApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Dobha Dobha',
      debugShowCheckedModeBanner: false,
      theme: dobhaTheme(),
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
    // Keep the splash up long enough to register, even when restoring is instant.
    Future.wait([
      AppState().restoreSession(),
      Future.delayed(const Duration(milliseconds: 1400)),
    ]).then((_) {
      if (mounted) setState(() => _splashDone = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final state = AppState();
        // Signing in (including from Google's callback) closes any open login/register screens.
        if (state.isLoggedIn && !_wasLoggedIn) {
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
