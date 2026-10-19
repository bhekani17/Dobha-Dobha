import 'package:flutter/material.dart';

import '../api.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/google_button.dart';
import '../widgets/ui.dart';
import 'support_screens.dart';
import 'terms_screen.dart';

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
              const Center(child: DobhaLogo(size: 150)),
              const SizedBox(height: 20),
              const Text(
                "Thrift Joburg's streets\nfrom your phone",
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: -0.8, height: 1.15),
              ),
              const SizedBox(height: 12),
              Text(
                'Dig through downtown bales from your phone. Watch sellers live and buy pieces in one tap.',
                textAlign: TextAlign.center,
                style: TextStyle(color: DobhaColors.muted, height: 1.5, fontSize: 15),
              ),
              const SizedBox(height: 32),
              _Feature(icon: Icons.sensors_rounded, color: DobhaColors.green, text: 'Live drops from Joburg stalls'),
              _Feature(icon: Icons.flash_on_rounded, color: DobhaColors.green, text: 'Buy a piece in one tap'),
              _Feature(icon: Icons.verified_user_rounded, color: DobhaColors.green, text: 'Sellers are paid only once you have it'),
              const Spacer(),
              AppButton(
                color: DobhaColors.green,
                padding: const EdgeInsets.symmetric(vertical: 17),
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RegisterScreen())),
                child: const Text('Create account', style: TextStyle(fontSize: 16)),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  side: BorderSide(color: DobhaColors.borderLight),
                  padding: const EdgeInsets.symmetric(vertical: 17),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LoginScreen())),
                child: const Text('I already have an account', style: TextStyle(fontSize: 16)),
              ),
              const GoogleSignInSection(),
              const _HelpLink(),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Need help?" for people who are not signed in: answers, and support by email.
class _HelpLink extends StatelessWidget {
  const _HelpLink();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: TextButton(
        onPressed: () => HelpScreen.open(context),
        child: Text('Need help?', style: TextStyle(color: DobhaColors.muted, fontSize: 13)),
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
          Expanded(child: Text(text, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500))),
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
  final bool showGoogle;

  const _AuthForm({
    required this.title,
    required this.subtitle,
    required this.fields,
    required this.error,
    required this.busy,
    required this.action,
    required this.onSubmit,
    required this.footer,
    this.showGoogle = true,
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
            Text(title, style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, letterSpacing: -0.8, height: 1.15)),
            const SizedBox(height: 8),
            Text(subtitle, style: TextStyle(color: DobhaColors.muted, fontSize: 15, height: 1.45)),
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
            if (showGoogle) const GoogleSignInSection(),
            const SizedBox(height: 22),
            footer,
          ],
        ),
      ),
    );
  }
}

/// Password input with a show/hide toggle. [isNew] tells password managers to suggest a new one.
class PasswordField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final TextInputAction action;
  final VoidCallback? onSubmitted;
  final bool isNew;
  const PasswordField({
    super.key,
    required this.controller,
    required this.label,
    this.action = TextInputAction.done,
    this.onSubmitted,
    this.isNew = false,
  });

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _hidden = true;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller,
      obscureText: _hidden,
      textInputAction: widget.action,
      autofillHints: [widget.isNew ? AutofillHints.newPassword : AutofillHints.password],
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
          PasswordField(controller: _password, label: 'Password', onSubmitted: _submit),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => ForgotPasswordScreen(email: _email.text.trim()))),
              child: const Text('Forgot password?'),
            ),
          ),
        ],
        footer: Column(
          children: [
            TextButton(
              onPressed: () => Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const RegisterScreen())),
              child: const Text('New here? Create an account'),
            ),
            const _HelpLink(),
          ],
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
  bool _agreed = false;
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
    if (!_agreed) return 'Please read and agree to the Terms and Conditions';
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
          PasswordField(controller: _password, label: 'Password (8+ characters)', action: TextInputAction.next, isNew: true),
          PasswordField(controller: _confirm, label: 'Confirm password', onSubmitted: _submit, isNew: true),
          TermsCheckbox(value: _agreed, onChanged: (v) => setState(() => _agreed = v)),
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

/// "Forgot password": email a 6-digit code, then set a new password with it (which also signs in).
class ForgotPasswordScreen extends StatefulWidget {
  final String email;
  const ForgotPasswordScreen({super.key, this.email = ''});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  late final _email = TextEditingController(text: widget.email);
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  bool _emailUnavailable = false;
  String? _error;

  static final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  @override
  void dispose() {
    for (final c in [_email, _code, _password, _confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          // The server can't send email yet: point to support instead of a dead end.
          _emailUnavailable = e.status == 503;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendCode() async {
    if (!_emailRe.hasMatch(_email.text.trim())) {
      setState(() => _error = 'Enter the email address on your account');
      return;
    }
    await _run(() async {
      await AppState().forgotPassword(_email.text.trim());
      if (mounted) setState(() => _codeSent = true);
    });
  }

  Future<void> _reset() async {
    String? problem;
    if (_code.text.trim().length != 6) {
      problem = 'Enter the 6-digit code from the email';
    } else if (_password.text.length < 8) {
      problem = 'Your new password must be at least 8 characters';
    } else if (_password.text != _confirm.text) {
      problem = 'Passwords do not match';
    }
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    // Signing in returns to the app through AuthGate.
    await _run(() => AppState().resetPassword(email: _email.text.trim(), code: _code.text.trim(), password: _password.text));
  }

  @override
  Widget build(BuildContext context) {
    final email = _email.text.trim();
    return AutofillGroup(
      child: _AuthForm(
        title: _codeSent ? 'Check your email' : 'Forgot password',
        subtitle: _codeSent
            ? 'If $email has a Dobha account, we sent it a 6-digit code. It works for 15 minutes. Check your spam folder too.'
            : 'Enter your email and we will send you a code to set a new password. If you signed up with Google, use Continue with Google instead.',
        error: _error,
        busy: _busy,
        action: _codeSent ? 'Set new password' : 'Send code',
        onSubmit: _codeSent ? _reset : _sendCode,
        showGoogle: false,
        fields: [
          if (!_codeSent)
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              onSubmitted: (_) => _sendCode(),
              decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline_rounded, size: 19)),
            )
          else ...[
            TextField(
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              autofillHints: const [AutofillHints.oneTimeCode],
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(labelText: '6-digit code', counterText: '', prefixIcon: Icon(Icons.pin_outlined, size: 19)),
            ),
            PasswordField(controller: _password, label: 'New password (8+ characters)', action: TextInputAction.next, isNew: true),
            PasswordField(controller: _confirm, label: 'Confirm new password', onSubmitted: _reset, isNew: true),
          ],
        ],
        footer: Column(
          children: [
            if (_codeSent) TextButton(onPressed: _busy ? null : _sendCode, child: const Text('Send a new code')),
            if (_emailUnavailable || _codeSent)
              TextButton(
                onPressed: () => ContactSupportScreen.open(context, topic: 'account'),
                child: Text(_emailUnavailable ? 'Contact support to get back in' : 'No email? Contact support'),
              ),
          ],
        ),
      ),
    );
  }
}
