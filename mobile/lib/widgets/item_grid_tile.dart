import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/thrift_item.dart';
import '../theme.dart';
import 'item_photo.dart';
import 'ui.dart';

/// Flat product tile for grids. Fades and slides in on first build, staggered
/// by [index], and shrinks slightly while pressed.
class ItemGridTile extends StatefulWidget {
  final ThriftItem item;
  final int index;
  final VoidCallback onTap;

  const ItemGridTile({super.key, required this.item, required this.index, required this.onTap});

  @override
  State<ItemGridTile> createState() => _ItemGridTileState();
}

class _ItemGridTileState extends State<ItemGridTile> with SingleTickerProviderStateMixin {
  late final AnimationController _appear = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
  late final Animation<double> _curve = CurvedAnimation(parent: _appear, curve: Curves.easeOutCubic);
  bool _pressed = false;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Tabs are built up front but hidden (tickers off). Wait until this tile is
    // actually on screen, so the animation is seen rather than finished off-screen.
    if (!_started && TickerMode.valuesOf(context).enabled) {
      _started = true;
      // Stagger the first screenful; tiles further down appear as they scroll in.
      Future.delayed(Duration(milliseconds: 45 * (widget.index % 8)), () {
        if (mounted) _appear.forward();
      });
    }
  }

  @override
  void dispose() {
    _appear.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final videos = item.media.where((m) => m.isVideo).length;

    return AnimatedBuilder(
      animation: _curve,
      builder: (context, child) => Opacity(
        opacity: _curve.value,
        child: Transform.translate(
          offset: Offset(0, 28 * (1 - _curve.value)),
          child: Transform.scale(scale: 0.94 + 0.06 * _curve.value, child: child),
        ),
      ),
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: () {
          HapticFeedback.selectionClick();
          widget.onTap();
        },
        child: AnimatedScale(
          scale: _pressed ? 0.96 : 1,
          duration: const Duration(milliseconds: 110),
          child: Container(
            clipBehavior: Clip.antiAlias,
            decoration: Surfaces.card(radius: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Hero(tag: 'item-${item.id}', child: ItemPhoto(item: item, iconSize: 40)),
                      if (videos > 0)
                        Positioned(
                          top: 8,
                          left: 8,
                          child: AppTag('VIDEO', color: DobhaColors.red, icon: Icons.play_arrow_rounded, solid: true),
                        ),
                      if (item.media.length > 1)
                        Positioned(
                          top: 8,
                          right: 8,
                          child: OverlayPanel(
                            radius: 8,
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.collections_outlined, size: 11),
                                const SizedBox(width: 3),
                                Text('${item.media.length}', style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800)),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(10, 9, 10, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(item.formattedPrice,
                                style: TextStyle(fontWeight: FontWeight.w900, color: DobhaColors.green, fontSize: 15)),
                          ),
                          if (item.isLiked) Icon(Icons.favorite, size: 14, color: DobhaColors.red),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(item.title,
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      const SizedBox(height: 2),
                      Text('${item.sellerName} · ${item.size}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: DobhaColors.muted, fontSize: 11)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
