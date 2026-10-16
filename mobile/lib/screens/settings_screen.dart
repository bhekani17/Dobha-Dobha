import 'package:flutter/material.dart';

import '../api.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/ui.dart';
import 'auth_screens.dart';
import 'edit_profile_screen.dart';
import 'support_screens.dart';
import 'terms_screen.dart';

/// Keep in step with `version` in pubspec.yaml.
const appVersion = '1.0.0';

/// Account, help, legal and sign-out, opened from the gear on the Me tab.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  static Future<void> open(BuildContext context) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen()));

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final state = AppState();
        if (!state.isLoggedIn) return const SizedBox.shrink();
        final user = state.user;
        return Scaffold(
          appBar: AppBar(title: const Text('Settings')),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
            children: [
              _Group('Account', [
                _Row(Icons.person_outline_rounded, 'Edit profile', onTap: () => EditProfileScreen.open(context)),
                if (user.hasPassword)
                  _Row(Icons.lock_outline_rounded, 'Change password', onTap: () => _changePassword(context))
                else
                  _Row(Icons.lock_outline_rounded, 'Signed in with Google', subtitle: user.email),
              ]),
              _Group('Help', [
                _Row(Icons.help_outline_rounded, 'Help and answers', onTap: () => HelpScreen.open(context)),
                _Row(Icons.support_agent_rounded, 'Contact support', onTap: () => ContactSupportScreen.open(context)),
                _Row(Icons.forum_outlined, 'Your questions', onTap: () => SupportRequestsScreen.open(context)),
              ]),
              _Group('About', [
                _Row(Icons.description_outlined, 'Terms and Conditions', onTap: () => TermsScreen.open(context)),
                _Row(Icons.privacy_tip_outlined, 'Privacy Policy', onTap: () => PrivacyScreen.open(context)),
                _Row(Icons.info_outline_rounded, 'About Dobha Dobha', onTap: () => AboutScreen.open(context)),
              ]),
              _Group('', [
                _Row(Icons.logout_rounded, 'Log out', color: DobhaColors.red, onTap: () => _confirmLogout(context)),
                _Row(Icons.delete_outline_rounded, 'Delete account', color: DobhaColors.red, onTap: () => _deleteAccount(context)),
              ]),
            ],
          ),
        );
      },
    );
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log out?'),
        content: Text(AppState().user.hasPassword
            ? 'You can log back in any time with your email and password.'
            : 'You can log back in any time with Continue with Google.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Log Out')),
        ],
      ),
    );
    if (ok == true) await AppState().logout();
  }

  Future<void> _changePassword(BuildContext context) async {
    final done = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _ChangePasswordSheet(),
    );
    if (done == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password changed. Other phones and browsers have been logged out.')),
      );
    }
  }

  Future<void> _deleteAccount(BuildContext context) async {
    final sure = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete your account?'),
        content: const Text(
          'This cannot be undone. Your profile, picture, listings that never sold, likes, saves, follows and '
          'notifications are removed. Records of past orders are kept, without your profile, as the law requires.\n\n'
          'Finish any orders in progress and withdraw your wallet first.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Continue', style: TextStyle(color: DobhaColors.red)),
          ),
        ],
      ),
    );
    if (sure != true || !context.mounted) return;
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _DeleteAccountSheet(),
    );
  }
}

class _Group extends StatelessWidget {
  final String title;
  final List<Widget> rows;
  const _Group(this.title, this.rows);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
              child: Text(title.toUpperCase(),
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: DobhaColors.muted)),
            ),
          AppCard(
            padding: EdgeInsets.zero,
            radius: 18,
            child: Column(
              children: [
                for (final (i, row) in rows.indexed) ...[
                  if (i > 0) Divider(height: 1, indent: 52, color: DobhaColors.border),
                  row,
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Color? color;
  final VoidCallback? onTap;
  const _Row(this.icon, this.title, {this.subtitle, this.color, this.onTap});

  @override
  Widget build(BuildContext context) {
    final fg = color ?? DobhaColors.text;
    return ListTile(
      onTap: onTap,
      leading: Icon(icon, color: color ?? DobhaColors.textSecondary, size: 21),
      title: Text(title, style: TextStyle(color: fg, fontWeight: FontWeight.w500, fontSize: 15)),
      subtitle: subtitle == null ? null : Text(subtitle!, style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
      trailing: onTap == null || color != null ? null : Icon(Icons.chevron_right_rounded, color: DobhaColors.muted),
      minLeadingWidth: 20,
    );
  }
}

/// Bottom-sheet form: title, explanation, fields, an error line and one action.
class _SheetForm extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<Widget> fields;
  final String? error;
  final bool busy;
  final String action;
  final Color? actionColor;
  final VoidCallback onSubmit;

  const _SheetForm({
    required this.title,
    required this.subtitle,
    required this.fields,
    required this.error,
    required this.busy,
    required this.action,
    this.actionColor,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 24, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
            const SizedBox(height: 6),
            Text(subtitle, style: TextStyle(color: DobhaColors.textSecondary, height: 1.4)),
            const SizedBox(height: 18),
            for (final f in fields) Padding(padding: const EdgeInsets.only(bottom: 12), child: f),
            if (error != null)
              AppWell(
                radius: 14,
                tint: DobhaColors.red,
                margin: const EdgeInsets.only(bottom: 12),
                child: Text(error!, style: TextStyle(color: DobhaColors.red, fontWeight: FontWeight.w600)),
              ),
            const SizedBox(height: 6),
            AppButton(
              color: actionColor ?? DobhaColors.green,
              foreground: actionColor != null ? Colors.white : null,
              onPressed: busy ? null : onSubmit,
              child: busy
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: actionColor != null ? Colors.white : Colors.black),
                    )
                  : Text(action),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChangePasswordSheet extends StatefulWidget {
  const _ChangePasswordSheet();

  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_current, _next, _confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    String? problem;
    if (_current.text.isEmpty) {
      problem = 'Enter your current password';
    } else if (_next.text.length < 8) {
      problem = 'Your new password must be at least 8 characters';
    } else if (_next.text != _confirm.text) {
      problem = 'The new passwords do not match';
    }
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppState().changePassword(current: _current.text, password: _next.text);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SheetForm(
      title: 'Change password',
      subtitle: 'You stay logged in here. Any other phones or browsers are logged out.',
      error: _error,
      busy: _busy,
      action: 'Change password',
      onSubmit: _submit,
      fields: [
        PasswordField(controller: _current, label: 'Current password', action: TextInputAction.next),
        PasswordField(controller: _next, label: 'New password (8+ characters)', action: TextInputAction.next, isNew: true),
        PasswordField(controller: _confirm, label: 'Confirm new password', onSubmitted: _submit, isNew: true),
      ],
    );
  }
}

class _DeleteAccountSheet extends StatefulWidget {
  const _DeleteAccountSheet();

  @override
  State<_DeleteAccountSheet> createState() => _DeleteAccountSheetState();
}

class _DeleteAccountSheetState extends State<_DeleteAccountSheet> {
  final _confirm = TextEditingController();
  final bool _hasPassword = AppState().user.hasPassword;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_hasPassword ? _confirm.text.isEmpty : _confirm.text.trim() != 'DELETE') {
      setState(() => _error = _hasPassword ? 'Enter your password' : 'Type DELETE in capitals to confirm');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // Signing out drops the app back to the welcome screen, which closes this sheet.
      await AppState().deleteAccount(password: _hasPassword ? _confirm.text : null);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SheetForm(
      title: 'Delete account',
      subtitle: _hasPassword
          ? 'Enter your password to permanently delete your Dobha Dobha account.'
          : 'Type DELETE to permanently delete your Dobha Dobha account.',
      error: _error,
      busy: _busy,
      action: 'Delete my account',
      actionColor: DobhaColors.red,
      onSubmit: _submit,
      fields: [
        _hasPassword
            ? PasswordField(controller: _confirm, label: 'Password', onSubmitted: _submit)
            : TextField(
                controller: _confirm,
                textCapitalization: TextCapitalization.characters,
                onSubmitted: (_) => _submit(),
                decoration: const InputDecoration(labelText: 'Type DELETE'),
              ),
      ],
    );
  }
}

/// What Dobha Dobha is, the version, and the legal pages and open-source licences.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  static Future<void> open(BuildContext context) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AboutScreen()));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('About')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          const Center(child: DobhaLogo(size: 120)),
          const SizedBox(height: 14),
          Center(child: Text('Version $appVersion', style: TextStyle(color: DobhaColors.muted, fontSize: 13))),
          const SizedBox(height: 24),
          Text(
            'Dobha Dobha brings the thrift stalls of downtown Johannesburg to your phone. Sellers list pieces and go '
            'live, shoppers buy in a tap, and we hold the money until the buyer has the piece, so both sides are covered.',
            style: TextStyle(color: DobhaColors.textSecondary, height: 1.55, fontSize: 15),
          ),
          const SizedBox(height: 24),
          _Group('', [
            _Row(Icons.description_outlined, 'Terms and Conditions', onTap: () => TermsScreen.open(context)),
            _Row(Icons.privacy_tip_outlined, 'Privacy Policy', onTap: () => PrivacyScreen.open(context)),
            _Row(
              Icons.code_rounded,
              'Open-source licences',
              onTap: () => showLicensePage(
                context: context,
                applicationName: 'Dobha Dobha',
                applicationVersion: appVersion,
              ),
            ),
          ]),
          Center(
            child: Text('Made in Johannesburg', style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
