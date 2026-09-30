import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../live_models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'item_photo.dart';
import 'ui.dart';

class PinnedProductBanner extends StatelessWidget {
  final PinnedItem? item;
  final bool isHost;
  final VoidCallback? onPinTap;
  final VoidCallback? onClaimTap;
  final VoidCallback? onUnpinTap;

  const PinnedProductBanner({
    super.key,
    required this.item,
    required this.isHost,
    this.onPinTap,
    this.onClaimTap,
    this.onUnpinTap,
  });

  @override
  Widget build(BuildContext context) {
    if (item == null) {
      if (!isHost) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
        child: AppButton(
          onPressed: onPinTap,
          radius: 16,
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.sell_outlined, color: DobhaColors.green, size: 18),
              SizedBox(width: 8),
              Text('Pin an item for sale', style: TextStyle(color: DobhaColors.green, fontSize: 13)),
            ],
          ),
        ),
      );
    }

    final current = item!;
    final isSold = current.isSold;
    final accent = isSold ? DobhaColors.amber : DobhaColors.green;

    return AppCard(
      margin: const EdgeInsets.fromLTRB(16, 14, 16, 6),
      radius: 20,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          AppWell(
            circle: true,
            padding: const EdgeInsets.all(9),
            tint: accent,
            child: Icon(isSold ? Icons.check_circle : Icons.local_offer, color: accent, size: 18),
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
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                      ),
                    ),
                    const SizedBox(width: 6),
                    AppTag(current.size),
                  ],
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Text(
                      current.price.startsWith('R') ? current.price : 'R ${current.price}',
                      style: TextStyle(
                        color: isSold ? DobhaColors.muted : DobhaColors.green,
                        fontWeight: FontWeight.w900,
                        fontSize: 15,
                        decoration: isSold ? TextDecoration.lineThrough : null,
                      ),
                    ),
                    if (isSold) ...[
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          'Sold to ${current.claimedBy ?? "buyer"}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: DobhaColors.amber, fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          if (isHost)
            PopupMenuButton<String>(
              icon: Icon(Icons.more_vert, color: DobhaColors.muted, size: 20),
              onSelected: (val) {
                if (val == 'edit') onPinTap?.call();
                if (val == 'unpin') onUnpinTap?.call();
              },
              itemBuilder: (context) => [
                const PopupMenuItem(value: 'edit', child: Text('Pin a different item')),
                PopupMenuItem(value: 'unpin', child: Text('Unpin item', style: TextStyle(color: DobhaColors.red))),
              ],
            )
          else if (!isSold)
            AppButton(
              color: DobhaColors.green,
              radius: 12,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              onPressed: () {
                HapticFeedback.mediumImpact();
                onClaimTap?.call();
              },
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [Icon(Icons.flash_on, size: 16), SizedBox(width: 4), Text('DOBHA', style: TextStyle(fontSize: 13))],
              ),
            )
          else
            AppTag('SOLD', color: DobhaColors.amber),
        ],
      ),
    );
  }
}


/// Host picks one of their unsold listings to pin in the stream.
Future<PinnedItem?> showPinItemModal({required BuildContext context, String? currentId}) {
  return showModalBottomSheet<PinnedItem>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) {
      final items = AppState().vendorInventory.where((i) => !i.isClaimed).toList();
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.7),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(Icons.sell_rounded, color: DobhaColors.green, size: 22),
                  const SizedBox(width: 8),
                  const Text('Pin an item', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  const Spacer(),
                  AppButton.icon(icon: Icons.close, size: 18, padding: 8, onPressed: () => Navigator.of(ctx).pop()),
                ],
              ),
              const SizedBox(height: 16),
              if (items.isEmpty)
                Padding(
                  padding: EdgeInsets.all(20),
                  child: Text('You have no unsold listings. Add items from the Go Live tab.',
                      textAlign: TextAlign.center, style: TextStyle(color: DobhaColors.muted)),
                )
              else
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    clipBehavior: Clip.none,
                    children: [
                      for (final item in items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: AppButton(
                            selected: item.id == currentId,
                            radius: 16,
                            padding: const EdgeInsets.all(10),
                            onPressed: () => Navigator.of(ctx).pop(
                              PinnedItem(id: item.id, title: item.title, price: item.formattedPrice, size: item.size),
                            ),
                            child: Row(
                              children: [
                                ItemThumb(item: item, size: 46),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(item.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(color: DobhaColors.text, fontSize: 13)),
                                ),
                                Text(item.formattedPrice, style: TextStyle(color: DobhaColors.green)),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      );
    },
  );
}
