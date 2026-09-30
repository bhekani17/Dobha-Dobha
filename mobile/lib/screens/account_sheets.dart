import 'package:flutter/material.dart';

import '../api.dart';
import '../models/user_profile.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/ui.dart';

/// Sheet with a few fields, an error line and one primary action.
class _FormSheet extends StatefulWidget {
  final String title;
  final String? subtitle;
  final List<(String label, TextEditingController ctrl, TextInputType type)> fields;
  final String action;
  final Future<void> Function() onSubmit;

  const _FormSheet({required this.title, this.subtitle, required this.fields, required this.action, required this.onSubmit});

  @override
  State<_FormSheet> createState() => _FormSheetState();
}

class _FormSheetState extends State<_FormSheet> {
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onSubmit();
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 24, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            if (widget.subtitle != null) ...[
              const SizedBox(height: 6),
              Text(widget.subtitle!, style: const TextStyle(color: DobhaColors.textSecondary, height: 1.35)),
            ],
            const SizedBox(height: 18),
            for (final (label, ctrl, type) in widget.fields)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextField(
                  controller: ctrl,
                  keyboardType: type,
                  textCapitalization: type == TextInputType.text ? TextCapitalization.words : TextCapitalization.none,
                  decoration: InputDecoration(labelText: label),
                ),
              ),
            if (_error != null)
              AppWell(
                radius: 14,
                tint: DobhaColors.red,
                margin: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: DobhaColors.red, fontWeight: FontWeight.w600)),
              ),
            const SizedBox(height: 6),
            AppButton(
              color: DobhaColors.green,
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : Text(widget.action),
            ),
          ],
        ),
      ),
    );
  }
}

/// Switch to vendor mode, asking for the shop details the server requires.
Future<bool> showBecomeVendorSheet(BuildContext context) async {
  final user = AppState().user;
  final shop = TextEditingController(text: user.shopName);
  final stall = TextEditingController(text: user.stallLocation);
  final done = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _FormSheet(
      title: 'Start selling',
      subtitle: 'Tell shoppers where to find you. You can list pieces and go live once this is set.',
      fields: [
        ('Shop name', shop, TextInputType.text),
        ('Stall location (e.g. Small Street Mall, Unit 4B)', stall, TextInputType.text),
      ],
      action: 'Switch to Vendor',
      onSubmit: () => AppState().updateProfile(
        shopName: shop.text.trim(),
        stallLocation: stall.text.trim(),
        role: UserRole.vendor,
      ),
    ),
  );
  return done == true;
}

Future<void> switchToShopper(BuildContext context) async {
  try {
    await AppState().updateProfile(role: UserRole.shopper);
  } on ApiException catch (e) {
    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
  }
}

Future<void> showEditProfileSheet(BuildContext context) async {
  final user = AppState().user;
  final name = TextEditingController(text: user.name);
  final phone = TextEditingController(text: user.phone);
  final shop = TextEditingController(text: user.shopName);
  final stall = TextEditingController(text: user.stallLocation);
  await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _FormSheet(
      title: 'Edit profile',
      fields: [
        ('Full name', name, TextInputType.text),
        ('Phone', phone, TextInputType.phone),
        if (user.isVendor) ...[
          ('Shop name', shop, TextInputType.text),
          ('Stall location', stall, TextInputType.text),
        ],
      ],
      action: 'Save',
      onSubmit: () => AppState().updateProfile(
        name: name.text.trim(),
        phone: phone.text.trim(),
        shopName: user.isVendor ? shop.text.trim() : null,
        stallLocation: user.isVendor ? stall.text.trim() : null,
      ),
    ),
  );
}
