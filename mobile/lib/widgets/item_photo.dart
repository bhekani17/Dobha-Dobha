import 'package:flutter/material.dart';

import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'ui.dart';

/// An item's photo, or a category icon on a flat well when it has none.
class ItemPhoto extends StatelessWidget {
  final ThriftItem item;
  final double iconSize;

  const ItemPhoto({super.key, required this.item, this.iconSize = 32});

  static IconData iconFor(String category) {
    switch (category.toLowerCase()) {
      case 'jackets':
        return Icons.dry_cleaning_rounded;
      case 'denim':
        return Icons.straighten_rounded;
      case 'sneakers':
        return Icons.skateboarding_rounded;
      case 'workwear':
        return Icons.handyman_rounded;
      default:
        return Icons.checkroom_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final placeholder = AppWell(
      padding: EdgeInsets.zero,
      radius: 0,
      child: Center(child: Icon(iconFor(item.category), size: iconSize, color: DobhaColors.green)),
    );
    final url = item.photoUrl;
    if (url == null) return placeholder;
    return Image.network(
      AppState().api.resolve(url),
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => placeholder,
      loadingBuilder: (context, child, progress) => progress == null ? child : placeholder,
    );
  }
}

/// Square thumbnail with rounded corners for list rows.
class ItemThumb extends StatelessWidget {
  final ThriftItem item;
  final double size;

  const ItemThumb({super.key, required this.item, this.size = 56});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: ClipRRect(borderRadius: BorderRadius.circular(size / 4), child: ItemPhoto(item: item, iconSize: size * 0.45)),
    );
  }
}
