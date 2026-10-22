import 'package:flutter/material.dart';

import '../models/social.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'item_photo.dart';
import 'ui.dart';

class CheckoutModal extends StatefulWidget {
  final List<ThriftItem> items;
  final Offer? offer;

  const CheckoutModal({super.key, required this.items, this.offer});

  static Future<void> show(
    BuildContext context,
    ThriftItem item, {
    Offer? offer,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => CheckoutModal(items: [item], offer: offer),
    );
  }

  static Future<void> showCart(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => CheckoutModal(items: AppState().cartAvailable),
    );
  }

  @override
  State<CheckoutModal> createState() => _CheckoutModalState();
}

class _CheckoutModalState extends State<CheckoutModal> {
  String _delivery = 'Seller-arranged courier (simulation)';
  String _payment = 'Card simulation';
  bool _busy = false;

  Future<void> _simulateCheckout() async {
    if (widget.items.isEmpty) return;
    setState(() => _busy = true);
    final total =
        widget.offer?.amountZar ??
        widget.items.fold<double>(0, (sum, item) => sum + item.priceZar);
    try {
      AppState().simulateCheckout(
        itemTitle: widget.items.length == 1
            ? widget.items.first.title
            : '${widget.items.length} cart items',
        amountZar: total,
        deliveryMethod: _delivery,
        paymentMethod: _payment,
        useDemoWallet: _payment == 'Temporary demo wallet',
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Simulation complete. No order, delivery booking, or payment was created.',
          ),
        ),
      );
    } on StateError catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = widget.items;
    final subtotal =
        widget.offer?.amountZar ??
        items.fold<double>(0, (sum, item) => sum + item.priceZar);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          14,
          20,
          MediaQuery.of(context).viewInsets.bottom + 20,
        ),
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
                  padding: const EdgeInsets.all(10),
                  tint: DobhaColors.amber,
                  child: Icon(
                    Icons.info_outline_rounded,
                    color: DobhaColors.amber,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Checkout simulator',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.3,
                    ),
                  ),
                ),
                AppButton.icon(
                  icon: Icons.close,
                  size: 18,
                  padding: 8,
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 16),
            AppWell(
              radius: 14,
              tint: DobhaColors.amber,
              child: const Text(
                'Simulation only: no real payment, order, delivery booking, balance change, or server write will happen.',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  height: 1.4,
                ),
              ),
            ),
            if (items.isNotEmpty) ...[
              const SizedBox(height: 14),
              AppCard(
                radius: 16,
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    for (var index = 0; index < items.length; index++)
                      Padding(
                        padding: EdgeInsets.only(
                          bottom: index == items.length - 1 ? 0 : 10,
                        ),
                        child: Row(
                          children: [
                            ItemThumb(item: items[index], size: 48),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                items[index].title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              index == 0 && widget.offer != null
                                  ? widget.offer!.formattedAmount
                                  : items[index].formattedPrice,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: _delivery,
              decoration: const InputDecoration(
                labelText: 'Delivery option · simulation',
              ),
              items:
                  const [
                        'Seller-arranged courier (simulation)',
                        'Buyer pickup (simulation)',
                        'Courier service (simulation)',
                      ]
                      .map(
                        (option) => DropdownMenuItem(
                          value: option,
                          child: Text(option),
                        ),
                      )
                      .toList(),
              onChanged: (value) =>
                  setState(() => _delivery = value ?? _delivery),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: _payment,
              decoration: const InputDecoration(
                labelText: 'Payment option · simulation',
              ),
              items: const ['Card simulation', 'Temporary demo wallet']
                  .map(
                    (option) =>
                        DropdownMenuItem(value: option, child: Text(option)),
                  )
                  .toList(),
              onChanged: (value) =>
                  setState(() => _payment = value ?? _payment),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Demo subtotal: R ${subtotal.toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            AppButton(
              color: DobhaColors.green,
              onPressed: _busy || items.isEmpty ? null : _simulateCheckout,
              child: Text(_busy ? 'Simulating…' : 'Run checkout simulation'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        ),
      ),
    );
  }
}
