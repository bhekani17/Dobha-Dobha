import 'dart:async';

import 'package:flutter/material.dart';

import '../google_auth.dart';
import '../theme.dart';
import 'google_button_stub.dart' if (dart.library.js_interop) 'google_button_web.dart';
import 'ui.dart';

/// "Continue with Google" with an "or" divider above it. Renders nothing when
/// Google sign-in isn't configured for this build.
class GoogleSignInSection extends StatefulWidget {
  final bool dividerAbove;
  const GoogleSignInSection({super.key, this.dividerAbove = true});

  @override
  State<GoogleSignInSection> createState() => _GoogleSignInSectionState();
}

class _GoogleSignInSectionState extends State<GoogleSignInSection> {
  StreamSubscription<String>? _errors;
  late final Future<void> _ready = GoogleAuth.ensureInitialized();

  @override
  void initState() {
    super.initState();
    _errors = GoogleAuth.errors.listen((msg) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    });
  }

  @override
  void dispose() {
    _errors?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!GoogleAuth.enabled) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.dividerAbove)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 18),
            child: Row(
              children: [
                Expanded(child: Divider()),
                Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('or', style: TextStyle(color: DobhaColors.muted))),
                Expanded(child: Divider()),
              ],
            ),
          ),
        ValueListenableBuilder<bool>(
          valueListenable: GoogleAuth.busy,
          builder: (context, busy, _) {
            if (busy) {
              return const Center(
                child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(color: DobhaColors.green)),
              );
            }
            return FutureBuilder<void>(
              future: _ready,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) return const SizedBox(height: 52);
                final web = googleWebButton();
                if (web != null) return Center(child: SizedBox(height: 48, child: web));
                return AppButton(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  onPressed: GoogleAuth.signIn,
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.g_mobiledata_rounded, size: 30),
                      SizedBox(width: 6),
                      Text('Continue with Google', style: TextStyle(fontSize: 15)),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ],
    );
  }
}
