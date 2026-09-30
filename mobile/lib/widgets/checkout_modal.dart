import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../models/social.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'item_photo.dart';
import 'ui.dart';

/// Checkout for one piece (optionally at an accepted offer's price) or for the whole cart.
class CheckoutModal extends StatefulWidget {
  final List<ThriftItem> items;
  final Offer? offer;
  final bool fromCart;

  const CheckoutModal({super.key, required this.items, this.offer, this.fromCart = false});

  static Future<bool?> show(BuildContext context, ThriftItem item, {Offer? offer}) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => CheckoutModal(items: [item], offer: offer),
    );
  }

  /// Buys every available piece in the cart; each becomes its own order.
  static Future<bool?> showCart(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => CheckoutModal(items: AppState().cartAvailable, fromCart: true),
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
    {'name': 'Capitec Pay (Instant)', 'icon': Icons.bolt},
    {'name': 'Ozow Instant EFT', 'icon': Icons.flash_on},
    {'name': 'Debit / Credit Card', 'icon': Icons.credit_card},
    {'name': 'Dobha In-App Wallet', 'icon': Icons.account_balance_wallet},
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
      var failed = <String>[];
      if (widget.fromCart) {
        failed = await AppState().checkoutCart(
          deliveryMethod: _selectedDelivery,
          paymentMethod: _selectedPayment,
          deliveryAddress: address,
        );
        if (failed.length == widget.items.length) {
          if (mounted) setState(() => _error = failed.first);
          return;
        }
      } else {
        await AppState().checkout(
          item: widget.items.single,
          deliveryMethod: _selectedDelivery,
          paymentMethod: _selectedPayment,
          deliveryAddress: address,
          offerId: widget.offer?.id,
        );
      }
      if (!mounted) return;
      final nav = Navigator.of(context);
      nav.pop(true);
      _showSuccessDialog(nav.context, failed);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  void _showSuccessDialog(BuildContext context, List<String> failed) {
    final many = widget.items.length > 1;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.check_circle_rounded, color: DobhaColors.green, size: 26),
            SizedBox(width: 10),
            Text(many ? "They're yours" : "It's yours", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              many
                  ? 'Each seller has been told to send their piece. We hold your payment until you tell us each one arrived. Follow them in the Orders tab.'
                  : 'The seller has been told to send it. We hold your payment until you tell us it arrived. Follow it in the Orders tab.',
              style: TextStyle(color: DobhaColors.textSecondary, fontSize: 14, height: 1.4),
            ),
            if (failed.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                '${failed.length} piece${failed.length == 1 ? '' : 's'} could not be bought and stayed in your cart: ${failed.first}',
                style: TextStyle(color: DobhaColors.red, fontSize: 13, height: 1.4),
              ),
            ],
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
    final items = widget.items;
    final itemsTotal = widget.offer?.amountZar ?? items.fold<double>(0, (sum, i) => sum + i.priceZar);
    // Each seller sends their piece separately, so delivery is per piece.
    final shippingTotal = _shippingFee * items.length;
    final total = itemsTotal + shippingTotal;

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
                      Text('Checkout', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                      Text('The seller is paid only once you have it', style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
                    ],
                  ),
                ),
                AppButton.icon(icon: Icons.close, size: 18, padding: 8, onPressed: () => Navigator.of(context).pop()),
              ],
            ),
            const SizedBox(height: 20),

            // What is being bought
            AppCard(
              radius: 20,
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  for (final item in items)
                    Padding(
                      padding: EdgeInsets.only(bottom: item == items.last ? 0 : 10),
                      child: Row(
                        children: [
                          ItemThumb(item: item, size: 52),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                                const SizedBox(height: 2),
                                Text('${item.sellerName} · Size ${item.size}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(widget.offer?.formattedAmount ?? item.formattedPrice,
                                  style: TextStyle(fontWeight: FontWeight.w700, color: DobhaColors.green, fontSize: 15)),
                              if (widget.offer != null)
                                Text(item.formattedPrice,
                                    style: TextStyle(
                                        fontSize: 12, color: DobhaColors.muted, decoration: TextDecoration.lineThrough)),
                            ],
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            if (items.length > 1)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('Each seller sends their piece separately, so delivery is charged per piece.',
                    style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
              ),
            const SizedBox(height: 22),

            Text('How do you want it?',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: DobhaColors.textSecondary)),
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
                                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: DobhaColors.text)),
                            Text(opt['sub'] as String,
                                style: TextStyle(fontSize: 11, color: DobhaColors.muted, fontWeight: FontWeight.w500)),
                          ],
                        ),
                      ),
                      Text(cost == 0 ? 'FREE' : 'R ${cost.toStringAsFixed(0)}${items.length > 1 ? ' each' : ''}',
                          style: TextStyle(fontWeight: FontWeight.w700, color: cost == 0 ? DobhaColors.green : DobhaColors.text)),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 6),

            TextField(
              controller: _addressCtrl,
              decoration: InputDecoration(
                labelText: 'Delivery address or PUDO locker',
                hintText: 'e.g. Campus Square PUDO, Auckland Park',
                prefixIcon: Icon(Icons.location_on_outlined, size: 18, color: DobhaColors.muted),
              ),
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 22),

            Text('Pay with', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: DobhaColors.textSecondary)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: _paymentOptions.map((pay) {
                final isSelected = _selectedPayment == pay['name'];
                return AppButton(
                  selected: isSelected,
                  radius: 14,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  onPressed: () => setState(() => _selectedPayment = pay['name'] as String),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(pay['icon'] as IconData, size: 16, color: isSelected ? DobhaColors.green : DobhaColors.muted),
                      const SizedBox(width: 6),
                      Text(pay['name'] as String,
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                              color: isSelected ? DobhaColors.green : DobhaColors.text)),
                    ],
                  ),
                );
              }).toList(),
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
                    Text('R ${total.toStringAsFixed(0)}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
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
                            : const Icon(Icons.check_rounded, size: 18),
                        const SizedBox(width: 8),
                        Text(_isProcessing ? 'Paying...' : 'Pay R ${total.toStringAsFixed(0)}'),
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
