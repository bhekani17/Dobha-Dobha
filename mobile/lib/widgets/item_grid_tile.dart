import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/thrift_item.dart';
import '../theme.dart';
import 'item_photo.dart';
import 'ui.dart';

/// Product tile for grids: rounded photo with price and details underneath. Fades and slides in on first build, staggered
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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ColoredBox(color: DobhaColors.surface),
                      Hero(tag: 'item-${item.id}', child: ItemPhoto(item: item, iconSize: 40)),
                      if (videos > 0)
                        const Positioned(
                          top: 8,
                          left: 8,
                          child: OverlayPanel(
                            radius: 20,
                            padding: EdgeInsets.all(4),
                            child: Icon(Icons.play_arrow_rounded, size: 16),
                          ),
                        ),
                      if (item.media.length > 1)
                        Positioned(
                          top: 8,
                          right: 8,
                          child: OverlayPanel(
                            radius: 20,
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            child: Text('1/${item.media.length}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                          ),
                        ),
                      if (item.isLiked)
                        Positioned(
                          bottom: 8,
                          right: 8,
                          child: OverlayPanel(
                            radius: 20,
                            padding: const EdgeInsets.all(5),
                            child: Icon(Icons.favorite, size: 14, color: DobhaColors.green),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(2, 8, 2, 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.formattedPrice,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, letterSpacing: -0.3)),
                    const SizedBox(height: 1),
                    Text(item.title,
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: DobhaColors.textSecondary)),
                    const SizedBox(height: 1),
                    Text('Size ${item.size}  ·  ${item.sellerName}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
