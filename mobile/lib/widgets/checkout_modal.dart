import 'package:flutter/material.dart';

import '../models/social.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'item_photo.dart';
import 'ui.dart';

/// Demo checkout for one piece (optionally at an accepted offer's price) or the cart.
class CheckoutModal extends StatefulWidget {
  final List<ThriftItem> items;
  final Offer? offer;

  const CheckoutModal({super.key, required this.items, this.offer});

  static Future<bool?> show(BuildContext context, ThriftItem item, {Offer? offer}) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => CheckoutModal(items: [item], offer: offer),
    );
  }

  /// Opens the demo checkout for every available piece in the cart.
  static Future<bool?> showCart(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => CheckoutModal(items: AppState().cartAvailable),
    );
  }

  @override
  State<CheckoutModal> createState() => _CheckoutModalState();
}

class _CheckoutModalState extends State<CheckoutModal> {
  String _selectedDelivery = 'Seller-arranged courier';
  String _selectedPayment = 'PayFast';
  bool _demoComplete = false;

  final _deliveryOptions = const [
    {'name': 'Seller-arranged courier', 'sub': 'Demo only; delivery is not booked'},
    {'name': 'Uber Direct', 'sub': 'Demo only; provider is not connected'},
    {'name': 'Courier service', 'sub': 'Demo only; provider is not connected'},
    {'name': 'Buyer pickup', 'sub': 'Demo only; pickup is not arranged'},
  ];

  final _paymentOptions = const [
    {'name': 'PayFast', 'sub': 'Demo only; no payment is taken'},
    {'name': 'Card payment', 'sub': 'Demo only; no card details requested'},
    {'name': 'Dobha wallet', 'sub': 'Demo only; no funds are available or moved'},
    {'name': 'Escrow protection', 'sub': 'Demo only; no funds are held'},
  ];

  @override
  Widget build(BuildContext context) {
    final items = widget.items;
    final itemsTotal = widget.offer?.amountZar ?? items.fold<double>(0, (sum, i) => sum + i.priceZar);

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
                      Text('Checkout', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                      Text('Demo checkout · no real purchase', style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
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
            const SizedBox(height: 16),

            Text('Delivery option · demo only',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: DobhaColors.textSecondary)),
            const SizedBox(height: 8),
            ..._deliveryOptions.map((opt) {
              final isSelected = _selectedDelivery == opt['name'];
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppButton(
                  selected: isSelected,
                  radius: 14,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  onPressed: () {
                    setState(() {
                      _selectedDelivery = opt['name'] as String;
                      _demoComplete = false;
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
                                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: DobhaColors.text)),
                            Text(opt['sub'] as String,
                                style: TextStyle(fontSize: 11, color: DobhaColors.muted, fontWeight: FontWeight.w500)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 8),

            Text('Payment option · demo only',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: DobhaColors.textSecondary)),
            const SizedBox(height: 8),
            ..._paymentOptions.map((opt) {
              final isSelected = _selectedPayment == opt['name'];
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppButton(
                  selected: isSelected,
                  radius: 14,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  onPressed: () {
                    setState(() {
                      _selectedPayment = opt['name'] as String;
                      _demoComplete = false;
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
                                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: DobhaColors.text)),
                            Text(opt['sub'] as String,
                                style: TextStyle(fontSize: 11, color: DobhaColors.muted, fontWeight: FontWeight.w500)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),

            AppWell(
              radius: 14,
              tint: DobhaColors.amber,
              margin: const EdgeInsets.only(top: 4, bottom: 12),
              child: const Text(
                'DEMO ONLY. No payment is taken, order is placed, delivery is booked, or wallet/escrow balance changed.',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),

            if (_demoComplete)
              AppWell(
                radius: 14,
                tint: DobhaColors.green,
                margin: const EdgeInsets.only(bottom: 12),
                child: Text(
                  'SIMULATED CHECKOUT — NO REAL ORDER\n'
                  '${items.length} item${items.length == 1 ? '' : 's'} · R ${itemsTotal.toStringAsFixed(2)} subtotal\n'
                  'Delivery: $_selectedDelivery · Payment: $_selectedPayment\n'
                  'No provider was contacted and no money or order was created.',
                  style: const TextStyle(fontWeight: FontWeight.w600, height: 1.45),
                ),
              ),

            Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Items subtotal', style: TextStyle(fontSize: 11, color: DobhaColors.muted)),
                    Text('R ${itemsTotal.toStringAsFixed(2)}',
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                  ],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: AppButton(
                    color: DobhaColors.green,
                    onPressed: () => setState(() => _demoComplete = true),
                    child: const Text('Run checkout demo'),
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
