import 'package:flutter/material.dart';

import '../api.dart';
import '../models/social.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'ui.dart';

class CheckoutModal extends StatelessWidget {
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

  Offer? _acceptedOfferFor(ThriftItem item) {
    if (offer?.item.id != item.id || offer?.status != 'accepted') return null;
    return offer;
  }

  Future<void> _requestToBuy(BuildContext context, ThriftItem item) async {
    final appState = AppState();
    if (!appState.isLoggedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in to request to buy this item.')),
      );
      return;
    }
    if (item.sellerId == appState.user.id) return;

    final itemOffer = _acceptedOfferFor(item);
    final amount = itemOffer?.formattedAmount ?? item.formattedPrice;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await appState.sendPurchaseRequest(
        item.sellerId,
        item,
        'I would like to buy "${item.title}" for $amount. Please confirm availability and arrange payment and collection with me.',
      );
      if (!context.mounted) return;
      Navigator.of(context).pop();
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            'Purchase request sent. Arrange payment and collection with the seller directly; Dobha has not processed payment.',
          ),
        ),
      );
    } on ApiException catch (error) {
      if (context.mounted) {
        messenger.showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final availableItems = items.where((item) => !item.isClaimed).toList();
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.max,
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
              const Text(
                'Request to buy directly',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 14),
              AppWell(
                radius: 14,
                child: Text(
                  'Send a purchase request without starting a chat yourself. The seller receives it as a message. This does not place an order, reserve an item, or process payment through Dobha; arrange payment and collection directly.',
                  style: TextStyle(
                    color: DobhaColors.textSecondary,
                    height: 1.4,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              if (availableItems.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Text(
                    'There are no available items to ask about.',
                    style: TextStyle(color: DobhaColors.textSecondary),
                  ),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: availableItems.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = availableItems[index];
                      final appState = AppState();
                      final isOwnItem = appState.isLoggedIn &&
                          item.sellerId == appState.user.id;
                      final itemOffer = _acceptedOfferFor(item);
                      final amount =
                          itemOffer?.formattedAmount ?? item.formattedPrice;
                      return AppWell(
                        radius: 14,
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    '${item.sellerName} · $amount',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: DobhaColors.textSecondary,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            TextButton(
                              onPressed: isOwnItem
                                  ? null
                                  : () => _requestToBuy(context, item),
                              child: Text(
                                isOwnItem ? 'Your listing' : 'Request to buy',
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Close'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
