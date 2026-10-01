import 'package:flutter/material.dart';

import '../api.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/checkout_modal.dart';
import '../widgets/item_photo.dart';
import '../widgets/ui.dart';
import 'feed_screen.dart';

/// Pieces saved for buying together. Checkout makes one order per piece.
class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  static Future<void> open(BuildContext context) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CartScreen()));

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  @override
  void initState() {
    super.initState();
    AppState().loadCart().catchError((_) {});
  }

  Future<void> _remove(ThriftItem item) async {
    try {
      await AppState().removeFromCart(item.id);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final cart = AppState().cart;
        final available = AppState().cartAvailable;
        final subtotal = available.fold<double>(0, (sum, i) => sum + i.priceZar);
        return Scaffold(
          appBar: AppBar(title: Text(cart.isEmpty ? 'Cart' : 'Cart (${cart.length})')),
          body: cart.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.shopping_bag_outlined, size: 48, color: DobhaColors.muted),
                        const SizedBox(height: 12),
                        const Text('Your cart is empty', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                        const SizedBox(height: 6),
                        Text('Tap the bag on any piece to add it here and buy several at once.',
                            textAlign: TextAlign.center, style: TextStyle(color: DobhaColors.muted, height: 1.4)),
                      ],
                    ),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: cart.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) => _CartRow(item: cart[i], onRemove: () => _remove(cart[i])),
                ),
          bottomNavigationBar: available.isEmpty
              ? null
              : SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                    child: Row(
                      children: [
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${available.length} piece${available.length == 1 ? '' : 's'}',
                                style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
                            Text('R ${subtotal.toStringAsFixed(0)}',
                                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                          ],
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: AppButton(
                            color: DobhaColors.green,
                            onPressed: () => CheckoutModal.showCart(context),
                            child: const Text('Checkout', style: TextStyle(fontSize: 15)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
        );
      },
    );
  }
}

class _CartRow extends StatelessWidget {
  final ThriftItem item;
  final VoidCallback onRemove;
  const _CartRow({required this.item, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    final gone = item.isClaimed;
    return AppCard(
      radius: 18,
      padding: const EdgeInsets.all(12),
      onTap: gone ? null : () => ItemDetailScreen.open(context, item),
      child: Opacity(
        opacity: gone ? 0.5 : 1,
        child: Row(
          children: [
            ItemThumb(item: item, size: 60),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.title,
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  const SizedBox(height: 2),
                  Text('${item.sellerName} · Size ${item.size}',
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
                  const SizedBox(height: 4),
                  Text(gone ? 'No longer available' : item.formattedPrice,
                      style: TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 14, color: gone ? DobhaColors.red : DobhaColors.green)),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Remove from cart',
              icon: Icon(Icons.close_rounded, color: DobhaColors.muted),
              onPressed: onRemove,
            ),
          ],
        ),
      ),
    );
  }
}

/// Bag icon with a count; opens the cart. Used on Home and Explore.
class CartButton extends StatelessWidget {
  /// Drawn over photos (Home) rather than on the page background.
  final bool overlay;
  const CartButton({super.key, this.overlay = false});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final n = AppState().cartAvailable.length;
        final button = overlay
            ? OverlayIconButton(icon: Icons.shopping_bag_outlined, size: 22, tooltip: 'Cart', onTap: () => CartScreen.open(context))
            : AppButton.icon(icon: Icons.shopping_bag_outlined, size: 20, padding: 10, onPressed: () => CartScreen.open(context));
        return Semantics(
          label: n == 0 ? 'Cart' : 'Cart, $n pieces',
          child: Badge(
            isLabelVisible: n > 0,
            label: Text('$n'),
            backgroundColor: DobhaColors.green,
            textColor: Colors.black,
            child: button,
          ),
        );
      },
    );
  }
}
