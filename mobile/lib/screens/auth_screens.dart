import 'package:flutter/material.dart';

import '../api.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/google_button.dart';
import '../widgets/ui.dart';

/// Brand mark used on the splash and welcome screens.
/// The brand logo for the current theme: transparent on dark, the original
/// black tile on light (clipped to its rounded corners).
class DobhaLogo extends StatelessWidget {
  final double size;
  const DobhaLogo({super.key, this.size = 120});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.2),
      child: Image.asset(
        DobhaColors.logoAsset,
        width: size,
        height: size,
        filterQuality: FilterQuality.high,
        semanticLabel: 'Dobha-Dobha',
      ),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ScaleTransition(
              scale: Tween(begin: 0.94, end: 1.04).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut)),
              child: const DobhaLogo(size: 200),
            ),
            const SizedBox(height: 24),
            Text('Joburg street thrift, live.',
                style: TextStyle(color: DobhaColors.muted, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
          ],
        ),
      ),
    );
  }
}

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Center(child: DobhaLogo(size: 170)),
              const SizedBox(height: 22),
              Text(
                'Dig through downtown bales from your phone. Watch sellers live and buy pieces in one tap.',
                textAlign: TextAlign.center,
                style: TextStyle(color: DobhaColors.textSecondary, height: 1.45, fontSize: 14),
              ),
              const SizedBox(height: 30),
              _Feature(icon: Icons.sensors_rounded, color: DobhaColors.green, text: 'Live drops from Joburg stalls'),
              _Feature(icon: Icons.flash_on_rounded, color: DobhaColors.green, text: 'Buy a piece in one tap'),
              _Feature(icon: Icons.verified_user_rounded, color: DobhaColors.green, text: 'Sellers are paid only once you have it'),
              const Spacer(),
              AppButton(
                color: DobhaColors.green,
                padding: const EdgeInsets.symmetric(vertical: 17),
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RegisterScreen())),
                child: const Text('Create Account', style: TextStyle(fontSize: 15)),
              ),
              const SizedBox(height: 16),
              AppButton(
                padding: const EdgeInsets.symmetric(vertical: 17),
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LoginScreen())),
                child: const Text('I already have an account', style: TextStyle(fontSize: 15)),
              ),
              const GoogleSignInSection(),
            ],
          ),
        ),
      ),
    );
  }
}

class _Feature extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String text;
  const _Feature({required this.icon, required this.color, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          AppWell(circle: true, padding: const EdgeInsets.all(9), tint: color, child: Icon(icon, size: 17, color: color)),
          const SizedBox(width: 14),
          Expanded(child: Text(text, style: const TextStyle(fontWeight: FontWeight.w700))),
        ],
      ),
    );
  }
}

/// Shared layout for the login and register forms.
class _AuthForm extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<Widget> fields;
  final String? error;
  final bool busy;
  final String action;
  final VoidCallback onSubmit;
  final Widget footer;

  const _AuthForm({
    required this.title,
    required this.subtitle,
    required this.fields,
    required this.error,
    required this.busy,
    required this.action,
    required this.onSubmit,
    required this.footer,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: AppButton.icon(icon: Icons.arrow_back_rounded, size: 20, padding: 10, onPressed: () => Navigator.of(context).pop()),
            ),
            const SizedBox(height: 28),
            Text(title, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(subtitle, style: TextStyle(color: DobhaColors.muted, fontSize: 14)),
            const SizedBox(height: 28),
            for (final f in fields) Padding(padding: const EdgeInsets.only(bottom: 14), child: f),
            if (error != null)
              AppWell(
                radius: 14,
                tint: DobhaColors.red,
                margin: const EdgeInsets.only(bottom: 14),
                child: Row(
                  children: [
                    Icon(Icons.error_outline_rounded, color: DobhaColors.red, size: 18),
                    const SizedBox(width: 10),
                    Expanded(child: Text(error!, style: TextStyle(color: DobhaColors.red, fontWeight: FontWeight.w600))),
                  ],
                ),
              ),
            const SizedBox(height: 8),
            AppButton(
              color: DobhaColors.green,
              padding: const EdgeInsets.symmetric(vertical: 17),
              onPressed: busy ? null : onSubmit,
              child: busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.black))
                  : Text(action, style: const TextStyle(fontSize: 15)),
            ),
            const GoogleSignInSection(),
            const SizedBox(height: 22),
            footer,
          ],
        ),
      ),
    );
  }
}

class _PasswordField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final TextInputAction action;
  final VoidCallback? onSubmitted;
  const _PasswordField({required this.controller, required this.label, this.action = TextInputAction.done, this.onSubmitted});

  @override
  State<_PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<_PasswordField> {
  bool _hidden = true;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller,
      obscureText: _hidden,
      textInputAction: widget.action,
      autofillHints: const [AutofillHints.password],
      onSubmitted: (_) => widget.onSubmitted?.call(),
      decoration: InputDecoration(
        labelText: widget.label,
        prefixIcon: const Icon(Icons.lock_outline_rounded, size: 19),
        suffixIcon: IconButton(
          icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 19),
          onPressed: () => setState(() => _hidden = !_hidden),
        ),
      ),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (email.isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Enter your email and password');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppState().login(email: email, password: _password.text);
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AutofillGroup(
      child: _AuthForm(
        title: 'Welcome back',
        subtitle: 'Log in to keep digging.',
        error: _error,
        busy: _busy,
        action: 'Log In',
        onSubmit: _submit,
        fields: [
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.email],
            decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline_rounded, size: 19)),
          ),
          _PasswordField(controller: _password, label: 'Password', onSubmitted: _submit),
        ],
        footer: Center(
          child: TextButton(
            onPressed: () => Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const RegisterScreen())),
            child: const Text('New here? Create an account'),
          ),
        ),
      ),
    );
  }
}

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _handle = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;

  static final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
  static final _handleRe = RegExp(r'^[a-z0-9_]{3,20}$');

  @override
  void dispose() {
    for (final c in [_name, _handle, _email, _phone, _password, _confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _validate() {
    final handle = _handle.text.trim().toLowerCase().replaceFirst('@', '');
    if (_name.text.trim().length < 2) return 'Enter your name';
    if (!_handleRe.hasMatch(handle)) return 'Username: 3-20 lowercase letters, numbers or _';
    if (!_emailRe.hasMatch(_email.text.trim())) return 'Enter a valid email address';
    if (_password.text.length < 8) return 'Password must be at least 8 characters';
    if (_password.text != _confirm.text) return 'Passwords do not match';
    return null;
  }

  Future<void> _submit() async {
    final problem = _validate();
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppState().register(
        name: _name.text.trim(),
        handle: _handle.text.trim().toLowerCase().replaceFirst('@', ''),
        email: _email.text.trim(),
        phone: _phone.text.trim(),
        password: _password.text,
      );
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AutofillGroup(
      child: _AuthForm(
        title: 'Create account',
        subtitle: 'Join the digital dobha. It takes a minute.',
        error: _error,
        busy: _busy,
        action: 'Create Account',
        onSubmit: _submit,
        fields: [
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.name],
            decoration: const InputDecoration(labelText: 'Full name', prefixIcon: Icon(Icons.person_outline_rounded, size: 19)),
          ),
          TextField(
            controller: _handle,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newUsername],
            decoration: const InputDecoration(labelText: 'Username', prefixText: '@', prefixIcon: Icon(Icons.alternate_email_rounded, size: 19)),
          ),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.email],
            decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline_rounded, size: 19)),
          ),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.telephoneNumber],
            decoration: const InputDecoration(labelText: 'Phone (optional)', prefixIcon: Icon(Icons.phone_outlined, size: 19)),
          ),
          _PasswordField(controller: _password, label: 'Password (8+ characters)', action: TextInputAction.next),
          _PasswordField(controller: _confirm, label: 'Confirm password', onSubmitted: _submit),
        ],
        footer: Center(
          child: TextButton(
            onPressed: () => Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen())),
            child: const Text('Already have an account? Log in'),
          ),
        ),
      ),
    );
  }
}
