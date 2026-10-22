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
  String _delivery = 'Seller-arranged courier';
  String _payment = 'Card';
  final _addressController = TextEditingController();
  bool _busy = false;

  Future<void> _checkout() async {
    if (widget.items.isEmpty) return;
    setState(() => _busy = true);
    try {
      await AppState().checkoutCart(
        deliveryMethod: _delivery,
        paymentMethod: _payment,
        deliveryAddress: _addressController.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Order placed successfully!'),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _addressController.dispose();
    super.dispose();
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
                const Expanded(
                  child: Text(
                    'Checkout',
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
                labelText: 'Delivery option',
              ),
              items:
                  const [
                        'Seller-arranged courier',
                        'Buyer pickup',
                        'Courier service',
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
                labelText: 'Payment option',
              ),
              items: const ['Card', 'Wallet']
                  .map(
                    (option) =>
                        DropdownMenuItem(value: option, child: Text(option)),
                  )
                  .toList(),
              onChanged: (value) =>
                  setState(() => _payment = value ?? _payment),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _addressController,
              decoration: const InputDecoration(
                labelText: 'Delivery address',
                hintText: 'Enter your delivery address',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Subtotal: R ${subtotal.toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            AppButton(
              color: DobhaColors.green,
              onPressed: _busy || items.isEmpty ? null : _checkout,
              child: Text(_busy ? 'Placing order…' : 'Place order'),
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
