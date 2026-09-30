import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';

class CheckoutModal extends StatefulWidget {
  final ThriftItem item;

  const CheckoutModal({super.key, required this.item});

  static Future<bool?> show(BuildContext context, ThriftItem item) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: DobhaColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => CheckoutModal(item: item),
    );
  }

  @override
  State<CheckoutModal> createState() => _CheckoutModalState();
}

class _CheckoutModalState extends State<CheckoutModal> {
  final _addressCtrl = TextEditingController(text: 'Campus Square PUDO Locker, Auckland Park');
  
  String _selectedDelivery = 'PUDO Locker-to-Locker (R 50)';
  double _shippingFee = 50.0;
  
  String _selectedPayment = 'Capitec Pay (Instant)';
  bool _isProcessing = false;

  final _deliveryOptions = const [
    {'name': 'PUDO Locker-to-Locker', 'cost': 50.0, 'sub': 'Collect safely from your nearest smart locker'},
    {'name': 'Courier Guy Door-to-Door', 'cost': 65.0, 'sub': 'Direct courier delivery to your residential address'},
    {'name': 'Downtown Joburg Safe Hub', 'cost': 0.0, 'sub': 'Free pickup at 73 Juta St, Braamfontein Hub'},
  ];

  final _paymentOptions = const [
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

  void _confirmClaim() async {
    HapticFeedback.heavyImpact();
    setState(() => _isProcessing = true);

    await Future.delayed(const Duration(milliseconds: 900));

    if (!mounted) return;

    final appState = AppState();
    final order = appState.claimAndCheckoutItem(
      item: widget.item,
      deliveryMethod: _selectedDelivery,
      paymentMethod: _selectedPayment,
      deliveryAddress: _addressCtrl.text.trim(),
      shippingFeeZar: _shippingFee,
    );

    setState(() => _isProcessing = false);

    if (mounted) {
      Navigator.of(context).pop(true);
      _showSuccessDialog(order.escrowVaultRef);
    }
  }

  void _showSuccessDialog(String vaultRef) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: DobhaColors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.verified_user_rounded, color: DobhaColors.green, size: 26),
            SizedBox(width: 10),
            Text('Claimed in Escrow!', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Your payment is safely locked in the Dobha Escrow Vault.',
              style: TextStyle(color: DobhaColors.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: DobhaColors.border.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: DobhaColors.borderLight),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Vault Ref: $vaultRef', style: const TextStyle(fontWeight: FontWeight.w700, color: DobhaColors.cyan, fontSize: 13)),
                  const SizedBox(height: 4),
                  const Text('Vendor notified to dispatch. Money is only paid when you tap "Received as Shown".', style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
                ],
              ),
            ),
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('View in Orders & Wallet'),
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
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: DobhaColors.borderLight,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: DobhaColors.green.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.flash_on, color: DobhaColors.green, size: 20),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Instant Dobha Claim', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                      Text('Backed by 100% In-App Escrow Guarantee', style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: DobhaColors.muted),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Item snapshot card
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: DobhaColors.cardElevated,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: DobhaColors.border),
              ),
              child: Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: DobhaColors.border,
                      borderRadius: BorderRadius.circular(8),
                      gradient: LinearGradient(
                        colors: [
                          DobhaColors.green.withValues(alpha: 0.3),
                          DobhaColors.escrowBlue.withValues(alpha: 0.3),
                        ],
                      ),
                    ),
                    child: const Center(
                      child: Icon(Icons.checkroom_rounded, color: DobhaColors.green, size: 28),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.item.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: DobhaColors.gold.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(widget.item.condition, style: const TextStyle(fontSize: 10, color: DobhaColors.gold, fontWeight: FontWeight.w700)),
                            ),
                            const SizedBox(width: 6),
                            Text('Size: ${widget.item.size}', style: const TextStyle(color: DobhaColors.muted, fontSize: 11)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(widget.item.formattedPrice, style: const TextStyle(fontWeight: FontWeight.w800, color: DobhaColors.green, fontSize: 15)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Delivery method
            const Text('Delivery / Collection Method', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: DobhaColors.textSecondary)),
            const SizedBox(height: 8),
            ..._deliveryOptions.map((opt) {
              final isSelected = _selectedDelivery.startsWith(opt['name'] as String);
              final cost = opt['cost'] as double;
              return Container(
                margin: const EdgeInsets.only(bottom: 6),
                decoration: BoxDecoration(
                  color: isSelected ? DobhaColors.green.withValues(alpha: 0.08) : DobhaColors.cardElevated,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isSelected ? DobhaColors.green : DobhaColors.border,
                    width: isSelected ? 1.5 : 1.0,
                  ),
                ),
                child: ListTile(
                  dense: true,
                  title: Text(opt['name'] as String, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  subtitle: Text(opt['sub'] as String, style: const TextStyle(fontSize: 11, color: DobhaColors.muted)),
                  trailing: Text(cost == 0 ? 'FREE' : 'R ${cost.toStringAsFixed(0)}', style: TextStyle(fontWeight: FontWeight.w800, color: cost == 0 ? DobhaColors.green : DobhaColors.text)),
                  onTap: () {
                    setState(() {
                      _selectedDelivery = '${opt['name']} (R ${cost.toStringAsFixed(0)})';
                      _shippingFee = cost;
                    });
                  },
                ),
              );
            }),
            const SizedBox(height: 8),

            // Delivery address field
            TextField(
              controller: _addressCtrl,
              decoration: const InputDecoration(
                labelText: 'Delivery Locker / Destination Address',
                prefixIcon: Icon(Icons.location_on_outlined, size: 18, color: DobhaColors.muted),
              ),
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 16),

            // Payment simulation method
            const Text('Payment Simulation (Instant Escrow Lock)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: DobhaColors.textSecondary)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _paymentOptions.map((pay) {
                final isSelected = _selectedPayment == pay['name'];
                return ChoiceChip(
                  label: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(pay['icon'] as IconData, size: 16, color: isSelected ? Colors.black : (pay['color'] as Color)),
                      const SizedBox(width: 6),
                      Text(pay['name'] as String, style: TextStyle(fontSize: 12, fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500, color: isSelected ? Colors.black : DobhaColors.text)),
                    ],
                  ),
                  selected: isSelected,
                  selectedColor: DobhaColors.green,
                  backgroundColor: DobhaColors.cardElevated,
                  side: BorderSide(color: isSelected ? DobhaColors.green : DobhaColors.border),
                  onSelected: (val) {
                    if (val) setState(() => _selectedPayment = pay['name'] as String);
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // Escrow Trust Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: DobhaColors.escrowIndigo.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: DobhaColors.escrowIndigo.withValues(alpha: 0.3)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.shield_outlined, color: DobhaColors.escrowBlue, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('In-App Escrow Vault Guarantee', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: DobhaColors.cyan)),
                        SizedBox(height: 2),
                        Text(
                          'Funds stay locked until you receive the package and confirm condition. Never get scammed on downtown bargains.',
                          style: TextStyle(fontSize: 11, color: DobhaColors.textSecondary, height: 1.3),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Cost summary & Action
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Total to Lock in Escrow:', style: TextStyle(fontSize: 11, color: DobhaColors.muted)),
                    Text('R ${total.toStringAsFixed(0)}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: DobhaColors.text)),
                  ],
                ),
                FilledButton.icon(
                  onPressed: _isProcessing ? null : _confirmClaim,
                  icon: _isProcessing
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                      : const Icon(Icons.lock_rounded, size: 18),
                  label: Text(_isProcessing ? 'Locking in Escrow...' : 'Lock & Claim Now'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
