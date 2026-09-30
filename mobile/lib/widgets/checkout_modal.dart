import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'ui.dart';

class CheckoutModal extends StatefulWidget {
  final ThriftItem item;

  const CheckoutModal({super.key, required this.item});

  static Future<bool?> show(BuildContext context, ThriftItem item) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => CheckoutModal(item: item),
    );
  }

  @override
  State<CheckoutModal> createState() => _CheckoutModalState();
}

class _CheckoutModalState extends State<CheckoutModal> {
  final _addressCtrl = TextEditingController();

  String _selectedDelivery = 'PUDO Locker-to-Locker';
  double _shippingFee = 50.0;

  String _selectedPayment = 'Capitec Pay (Instant)';
  bool _isProcessing = false;
  String? _error;

  // Names and prices must match the server's DELIVERY table.
  final _deliveryOptions = const [
    {'name': 'PUDO Locker-to-Locker', 'cost': 50.0, 'sub': 'Collect from your nearest smart locker'},
    {'name': 'Courier Guy Door-to-Door', 'cost': 65.0, 'sub': 'Courier delivery to your address'},
    {'name': 'Downtown Joburg Safe Hub', 'cost': 0.0, 'sub': 'Free pickup at the Braamfontein hub'},
  ];

  final _paymentOptions = [
    {'name': 'Capitec Pay (Instant)', 'icon': Icons.bolt, 'color': Color(0xFF007A3D)},
    {'name': 'Ozow Instant EFT', 'icon': Icons.flash_on, 'color': Color(0xFFEF4444)},
    {'name': 'Debit / Credit Card', 'icon': Icons.credit_card, 'color': Color(0xFF3B82F6)},
    {'name': 'Dobha In-App Wallet', 'icon': Icons.account_balance_wallet, 'color': DobhaColors.green},
  ];

  @override
  void dispose() {
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _confirmClaim() async {
    final address = _addressCtrl.text.trim();
    if (address.length < 5) {
      setState(() => _error = 'Enter the locker or address to deliver to');
      return;
    }
    HapticFeedback.heavyImpact();
    setState(() {
      _isProcessing = true;
      _error = null;
    });

    try {
      final order = await AppState().checkout(
        item: widget.item,
        deliveryMethod: _selectedDelivery,
        paymentMethod: _selectedPayment,
        deliveryAddress: address,
      );
      if (!mounted) return;
      final nav = Navigator.of(context);
      nav.pop(true);
      _showSuccessDialog(nav.context, order.escrowVaultRef);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  void _showSuccessDialog(BuildContext context, String vaultRef) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.verified_user_rounded, color: DobhaColors.green, size: 26),
            SizedBox(width: 10),
            Text('Claimed!', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Your payment is locked in the Dobha escrow vault.',
              style: TextStyle(color: DobhaColors.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 14),
            AppWell(
              radius: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Vault Ref: $vaultRef',
                      style: TextStyle(fontWeight: FontWeight.w800, color: DobhaColors.cyan, fontSize: 13)),
                  const SizedBox(height: 4),
                  Text('The vendor has been notified. They are only paid once you confirm "Received as Shown".',
                      style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
                ],
              ),
            ),
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.item.priceZar + _shippingFee;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 14,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        clipBehavior: Clip.none,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 5,
                margin: const EdgeInsets.only(bottom: 18),
                decoration: Surfaces.well(radius: 3),
              ),
            ),

            Row(
              children: [
                AppWell(
                  circle: true,
                  padding: EdgeInsets.all(10),
                  tint: DobhaColors.green,
                  child: Icon(Icons.flash_on, color: DobhaColors.green, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Dobha Claim', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                      Text('Protected by in-app escrow', style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
                    ],
                  ),
                ),
                AppButton.icon(icon: Icons.close, size: 18, padding: 8, onPressed: () => Navigator.of(context).pop()),
              ],
            ),
            const SizedBox(height: 20),

            // Item snapshot
            AppCard(
              radius: 20,
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  AppWell(
                    width: 58,
                    height: 58,
                    radius: 14,
                    padding: EdgeInsets.zero,
                    child: Center(child: Icon(Icons.checkroom_rounded, color: DobhaColors.green, size: 28)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.item.title,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Flexible(child: AppTag(widget.item.condition, color: DobhaColors.gold)),
                            const SizedBox(width: 8),
                            Text('Size ${widget.item.size}', style: TextStyle(color: DobhaColors.muted, fontSize: 11)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(widget.item.formattedPrice,
                            style: TextStyle(fontWeight: FontWeight.w900, color: DobhaColors.green, fontSize: 15)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),

            Text('Delivery / Collection',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: DobhaColors.textSecondary)),
            const SizedBox(height: 12),
            ..._deliveryOptions.map((opt) {
              final isSelected = _selectedDelivery == opt['name'];
              final cost = opt['cost'] as double;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AppButton(
                  selected: isSelected,
                  radius: 16,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  onPressed: () {
                    setState(() {
                      _selectedDelivery = opt['name'] as String;
                      _shippingFee = cost;
                    });
                  },
                  child: Row(
                    children: [
                      Icon(isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                          size: 18, color: isSelected ? DobhaColors.green : DobhaColors.muted),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(opt['name'] as String,
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: DobhaColors.text)),
                            Text(opt['sub'] as String,
                                style: TextStyle(fontSize: 11, color: DobhaColors.muted, fontWeight: FontWeight.w500)),
                          ],
                        ),
                      ),
                      Text(cost == 0 ? 'FREE' : 'R ${cost.toStringAsFixed(0)}',
                          style: TextStyle(fontWeight: FontWeight.w900, color: cost == 0 ? DobhaColors.green : DobhaColors.text)),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 6),

            TextField(
              controller: _addressCtrl,
              decoration: InputDecoration(
                labelText: 'Locker / Delivery Address',
                hintText: 'e.g. Campus Square PUDO, Auckland Park',
                prefixIcon: Icon(Icons.location_on_outlined, size: 18, color: DobhaColors.muted),
              ),
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 22),

            Text('Pay With', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: DobhaColors.textSecondary)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: _paymentOptions.map((pay) {
                final isSelected = _selectedPayment == pay['name'];
                final color = pay['color'] as Color;
                return AppButton(
                  selected: isSelected,
                  radius: 14,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  onPressed: () => setState(() => _selectedPayment = pay['name'] as String),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(pay['icon'] as IconData, size: 16, color: isSelected ? DobhaColors.green : color),
                      const SizedBox(width: 6),
                      Text(pay['name'] as String,
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                              color: isSelected ? DobhaColors.green : DobhaColors.text)),
                    ],
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 22),

            AppWell(
              radius: 16,
              tint: DobhaColors.escrowIndigo,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.shield_outlined, color: DobhaColors.cyan, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Funds stay locked until you receive the piece and confirm its condition.',
                      style: TextStyle(fontSize: 11.5, color: DobhaColors.textSecondary, height: 1.35),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),

            if (_error != null)
              AppWell(
                radius: 14,
                tint: DobhaColors.red,
                margin: const EdgeInsets.only(bottom: 16),
                child: Text(_error!, style: TextStyle(color: DobhaColors.red, fontWeight: FontWeight.w600)),
              ),

            Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Total', style: TextStyle(fontSize: 11, color: DobhaColors.muted)),
                    Text('R ${total.toStringAsFixed(0)}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
                  ],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: AppButton(
                    color: DobhaColors.green,
                    onPressed: _isProcessing ? null : _confirmClaim,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _isProcessing
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                            : const Icon(Icons.lock_rounded, size: 18),
                        const SizedBox(width: 8),
                        Text(_isProcessing ? 'Locking...' : 'Lock & Claim'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
