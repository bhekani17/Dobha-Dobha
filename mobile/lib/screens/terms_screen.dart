import 'package:flutter/material.dart';

import '../legal/terms.dart';
import '../theme.dart';

/// The Terms and Conditions, readable from registration, sign-in and the Me tab settings.
class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  static Future<void> open(BuildContext context) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const TermsScreen()));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Terms and Conditions')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 40),
        children: [
          Text('Last updated $termsUpdated', style: TextStyle(color: DobhaColors.muted, fontSize: 13)),
          const SizedBox(height: 8),
          for (final section in termsSections) ...[
            const SizedBox(height: 18),
            Text(section.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            for (final p in section.paragraphs) ...[
              const SizedBox(height: 8),
              Text(p, style: TextStyle(fontSize: 14.5, height: 1.5, color: DobhaColors.textSecondary)),
            ],
          ],
        ],
      ),
    );
  }
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

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Center(
        child: Wrap(
          alignment: WrapAlignment.center,
          children: [
            Text('By continuing, you agree to the ', style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
            GestureDetector(
              onTap: () => TermsScreen.open(context),
              child: Text('Terms and Conditions',
                  style: TextStyle(color: DobhaColors.muted, fontSize: 12, decoration: TextDecoration.underline, decorationColor: DobhaColors.muted)),
            ),
          ],
        ),
      ),
    );
  }
}
