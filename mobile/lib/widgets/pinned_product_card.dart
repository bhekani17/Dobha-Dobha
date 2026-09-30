import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../live_models.dart';
import '../theme.dart';

class PinnedProductBanner extends StatelessWidget {
  final PinnedItem? item;
  final bool isHost;
  final VoidCallback? onPinTap;
  final VoidCallback? onClaimTap;
  final VoidCallback? onMarkSoldTap;
  final VoidCallback? onUnpinTap;

  const PinnedProductBanner({
    super.key,
    required this.item,
    required this.isHost,
    this.onPinTap,
    this.onClaimTap,
    this.onMarkSoldTap,
    this.onUnpinTap,
  });

  @override
  Widget build(BuildContext context) {
    if (item == null) {
      if (!isHost) return const SizedBox.shrink();
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: InkWell(
          onTap: onPinTap,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
            decoration: BoxDecoration(
              color: DobhaColors.card.withValues(alpha: 0.85),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: DobhaColors.green.withValues(alpha: 0.4), width: 1.2),
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.sell_outlined, color: DobhaColors.green, size: 18),
                SizedBox(width: 8),
                Text(
                  '+ Pin an item for sale (name & price)',
                  style: TextStyle(color: DobhaColors.green, fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final current = item!;
    final isSold = current.isSold;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF161616).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isSold ? Colors.amber.withValues(alpha: 0.5) : DobhaColors.green.withValues(alpha: 0.6),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.5),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isSold ? Colors.amber.withValues(alpha: 0.15) : DobhaColors.green.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isSold ? Icons.check_circle : Icons.local_offer,
              color: isSold ? Colors.amber : DobhaColors.green,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        current.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: DobhaColors.border,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        current.size,
                        style: const TextStyle(fontSize: 10, color: DobhaColors.muted, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      current.price.startsWith('R') ? current.price : 'R ${current.price}',
                      style: TextStyle(
                        color: isSold ? DobhaColors.muted : DobhaColors.green,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        decoration: isSold ? TextDecoration.lineThrough : null,
                      ),
                    ),
                    if (isSold) ...[
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          'Sold to ${current.claimedBy ?? "buyer"} 🎉',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          if (isHost) ...[
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, color: DobhaColors.muted, size: 20),
              color: DobhaColors.card,
              onSelected: (val) {
                if (val == 'edit') onPinTap?.call();
                if (val == 'sold') onMarkSoldTap?.call();
                if (val == 'unpin') onUnpinTap?.call();
              },
              itemBuilder: (context) => [
                const PopupMenuItem(value: 'edit', child: Text('Edit item')),
                if (!isSold) const PopupMenuItem(value: 'sold', child: Text('Mark as Sold')),
                const PopupMenuItem(value: 'unpin', child: Text('Unpin item', style: TextStyle(color: DobhaColors.red))),
              ],
            ),
          ] else ...[
            if (!isSold)
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: DobhaColors.green,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  elevation: 0,
                ),
                onPressed: () {
                  HapticFeedback.mediumImpact();
                  onClaimTap?.call();
                },
                icon: const Icon(Icons.flash_on, size: 16),
                label: const Text('DOBHA', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              )
            else
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.withValues(alpha: 0.5)),
                ),
                child: const Text('SOLD', style: TextStyle(color: Colors.amber, fontWeight: FontWeight.w800, fontSize: 11)),
              ),
          ],
        ],
      ),
    );
  }
}

Future<PinnedItem?> showPinItemModal({
  required BuildContext context,
  PinnedItem? currentItem,
}) async {
  final titleCtrl = TextEditingController(text: currentItem?.title ?? '');
  final priceCtrl = TextEditingController(text: currentItem?.price.replaceFirst('R', '').trim() ?? '');
  String selectedSize = currentItem?.size ?? 'M';

  final sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'Free Size'];

  return showModalBottomSheet<PinnedItem>(
    context: context,
    isScrollControlled: true,
    backgroundColor: DobhaColors.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      return StatefulBuilder(
        builder: (ctx, setModalState) {
          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(Icons.sell_rounded, color: DobhaColors.green, size: 22),
                    const SizedBox(width: 8),
                    Text(
                      currentItem == null ? 'Pin item for sale' : 'Update pinned item',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close, color: DobhaColors.muted),
                      onPressed: () => Navigator.of(ctx).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: titleCtrl,
                  autofocus: true,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Item name / description',
                    hintText: 'e.g. Nike Vintage Track Jacket',
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: TextField(
                        controller: priceCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Price (ZAR)',
                          prefixText: 'R ',
                          hintText: '150',
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: DropdownButtonFormField<String>(
                        initialValue: sizes.contains(selectedSize) ? selectedSize : 'M',
                        decoration: const InputDecoration(labelText: 'Size'),
                        dropdownColor: DobhaColors.card,
                        items: sizes
                            .map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 14))))
                            .toList(),
                        onChanged: (val) {
                          if (val != null) setModalState(() => selectedSize = val);
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: () {
                    final title = titleCtrl.text.trim();
                    final price = priceCtrl.text.trim();
                    if (title.isEmpty || price.isEmpty) return;
                    Navigator.of(ctx).pop(
                      PinnedItem(
                        id: currentItem?.id ?? DateTime.now().millisecondsSinceEpoch.toString(),
                        title: title,
                        price: price.startsWith('R') ? price : 'R $price',
                        size: selectedSize,
                        status: 'available',
                      ),
                    );
                  },
                  icon: const Icon(Icons.push_pin_rounded, size: 18),
                  label: Text(currentItem == null ? 'Pin Item to Live' : 'Update Item'),
                ),
              ],
            ),
          );
        },
      );
    },
  );
}
