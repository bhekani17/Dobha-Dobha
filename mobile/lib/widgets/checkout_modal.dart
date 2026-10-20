import 'package:flutter/material.dart';

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

  const CheckoutModal({super.key, required this.items, this.offer});

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
      builder: (ctx) => CheckoutModal(items: AppState().cartAvailable),
    );
  }

  @override
  State<CheckoutModal> createState() => _CheckoutModalState();
}

class _CheckoutModalState extends State<CheckoutModal> {
  String _selectedDelivery = 'PUDO Locker-to-Locker';
  double _shippingFee = 50.0;

  // Names and prices must match the server's DELIVERY table.
  final _deliveryOptions = const [
    {'name': 'PUDO Locker-to-Locker', 'cost': 50.0, 'sub': 'Collect from your nearest smart locker'},
    {'name': 'Courier Guy Door-to-Door', 'cost': 65.0, 'sub': 'Courier delivery to your address'},
    {'name': 'Downtown Joburg Safe Hub', 'cost': 0.0, 'sub': 'Free pickup at the Braamfontein hub'},
  ];

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
                      Text('Checkout', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                      Text('Review a potential purchase', style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
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
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: DobhaColors.textSecondary)),
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
                                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: DobhaColors.text)),
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

            AppWell(
              radius: 14,
              tint: DobhaColors.amber,
              margin: const EdgeInsets.only(bottom: 16),
              child: const Text(
                'Checkout is unavailable. Dobha does not currently process payments or hold funds. No order will be placed.',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),

            Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Total', style: TextStyle(fontSize: 11, color: DobhaColors.muted)),
                    Text('R ${total.toStringAsFixed(0)}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                  ],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: AppButton(
                    onPressed: null,
                    child: const Text('Checkout unavailable'),
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
