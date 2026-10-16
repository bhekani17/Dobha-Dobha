import 'package:flutter/material.dart';

import '../legal/privacy.dart';
import '../legal/terms.dart';
import '../theme.dart';

/// A legal page (Terms and Conditions, Privacy Policy): a date line, then numbered sections.
class LegalScreen extends StatelessWidget {
  final String title;
  final String updated;
  final List<TermsSection> sections;

  const LegalScreen({super.key, required this.title, required this.updated, required this.sections});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 40),
        children: [
          Text('Last updated $updated', style: TextStyle(color: DobhaColors.muted, fontSize: 13)),
          const SizedBox(height: 8),
          for (final section in sections) ...[
            const SizedBox(height: 18),
            Text(section.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
            for (final p in section.paragraphs) ...[
              const SizedBox(height: 8),
              Text(p, style: TextStyle(fontSize: 15, height: 1.5, color: DobhaColors.textSecondary)),
            ],
          ],
        ],
      ),
    );
  }
}

/// The Terms and Conditions, readable from registration, sign-in and Settings.
class TermsScreen {
  static Future<void> open(BuildContext context) => Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => const LegalScreen(title: 'Terms and Conditions', updated: termsUpdated, sections: termsSections)));
}

/// The Privacy Policy, readable from Settings and the welcome screens.
class PrivacyScreen {
  static Future<void> open(BuildContext context) => Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => const LegalScreen(title: 'Privacy Policy', updated: privacyUpdated, sections: privacySections)));
}

/// "I agree to the Terms and Conditions" with the terms one tap away.
class TermsCheckbox extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  const TermsCheckbox({super.key, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Checkbox(
          value: value,
          activeColor: DobhaColors.green,
          checkColor: Colors.black,
          onChanged: (v) => onChanged(v ?? false),
        ),
        Expanded(
          child: Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              GestureDetector(
                onTap: () => onChanged(!value),
                child: Text('I agree to the ', style: TextStyle(color: DobhaColors.textSecondary)),
              ),
              GestureDetector(
                onTap: () => TermsScreen.open(context),
                child: Text(
                  'Terms and Conditions',
                  style: TextStyle(color: DobhaColors.green, fontWeight: FontWeight.w600, decoration: TextDecoration.underline, decorationColor: DobhaColors.green),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Small print under "Continue with Google", which can create a new account.
class TermsNotice extends StatelessWidget {
  const TermsNotice({super.key});

  static Widget _link(BuildContext context, String text, Future<void> Function(BuildContext) open) => GestureDetector(
        onTap: () => open(context),
        child: Text(text,
            style: TextStyle(color: DobhaColors.muted, fontSize: 12, decoration: TextDecoration.underline, decorationColor: DobhaColors.muted)),
      );

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Center(
        child: Wrap(
          alignment: WrapAlignment.center,
          children: [
            Text('By continuing, you agree to the ', style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
            _link(context, 'Terms and Conditions', TermsScreen.open),
            Text(' and ', style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
            _link(context, 'Privacy Policy', PrivacyScreen.open),
          ],
        ),
      ),
    );
  }
}
