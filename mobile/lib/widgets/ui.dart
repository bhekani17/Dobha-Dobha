import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme.dart';

/// Flat building blocks: solid colour surfaces, no shadows or gradients.
/// Hierarchy comes from surface tone; state (pressed, selected) from colour.
class Surfaces {
  /// A card or panel sitting on the page.
  static BoxDecoration card({double radius = 16, Color? color, bool circle = false}) {
    return BoxDecoration(
      color: color ?? DobhaColors.surface,
      shape: circle ? BoxShape.circle : BoxShape.rectangle,
      borderRadius: circle ? null : BorderRadius.circular(radius),
    );
  }

  /// A recessed area inside a card (thumbnails, stats, fields), optionally tinted.
  static BoxDecoration well({double radius = 12, Color? tint, bool circle = false}) {
    return BoxDecoration(
      color: tint == null ? DobhaColors.well : Color.alphaBlend(tint.withValues(alpha: 0.16), DobhaColors.well),
      shape: circle ? BoxShape.circle : BoxShape.rectangle,
      borderRadius: circle ? null : BorderRadius.circular(radius),
    );
  }
}

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final double radius;
  final VoidCallback? onTap;

  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin,
    this.radius = 16,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(margin: margin, padding: padding, decoration: Surfaces.card(radius: radius), child: child);
    return onTap == null ? card : GestureDetector(onTap: onTap, behavior: HitTestBehavior.opaque, child: card);
  }
}

class AppWell extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final double radius;
  final Color? tint;
  final bool circle;
  final double? width;
  final double? height;

  const AppWell({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(12),
    this.margin,
    this.radius = 12,
    this.tint,
    this.circle = false,
    this.width,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      margin: margin,
      padding: padding,
      decoration: Surfaces.well(radius: radius, tint: tint, circle: circle),
      child: child,
    );
  }
}

/// Flat button. With [color] it is a filled accent button; otherwise a
/// neutral one. [selected] shows a tinted, accent-labelled state.
class AppButton extends StatefulWidget {
  final Widget child;
  final VoidCallback? onPressed;
  final Color? color;
  final Color? foreground;
  final double radius;
  final EdgeInsetsGeometry padding;
  final bool circle;
  final bool selected;

  const AppButton({
    super.key,
    required this.child,
    required this.onPressed,
    this.color,
    this.foreground,
    this.radius = 12,
    this.padding = const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
    this.circle = false,
    this.selected = false,
  });

  /// Round icon-only button.
  factory AppButton.icon({
    Key? key,
    required IconData icon,
    required VoidCallback? onPressed,
    Color? iconColor,
    double size = 22,
    double padding = 12,
    bool selected = false,
  }) {
    return AppButton(
      key: key,
      onPressed: onPressed,
      circle: true,
      selected: selected,
      padding: EdgeInsets.all(padding),
      child: Icon(icon, color: iconColor ?? DobhaColors.text, size: size),
    );
  }

  @override
  State<AppButton> createState() => _AppButtonState();
}

class _AppButtonState extends State<AppButton> {
  bool _down = false;

  void _set(bool v) {
    if (widget.onPressed != null && _down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;
    final accent = widget.color;
    final fg = widget.foreground ?? (accent != null ? Colors.black : DobhaColors.text);

    Color bg;
    if (accent != null) {
      bg = accent;
    } else if (widget.selected) {
      bg = Color.alphaBlend(DobhaColors.green.withValues(alpha: 0.16), DobhaColors.cardElevated);
    } else {
      // One step lighter than cards, so plain buttons stand out on the page and on cards.
      bg = DobhaColors.cardElevated;
    }
    if (_down) bg = Color.lerp(bg, Colors.black, 0.15)!;

    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _set(true),
        onTapUp: (_) => _set(false),
        onTapCancel: () => _set(false),
        onTap: enabled
            ? () {
                HapticFeedback.selectionClick();
                widget.onPressed!();
              }
            : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 90),
          padding: widget.padding,
          decoration: BoxDecoration(
            color: bg,
            shape: widget.circle ? BoxShape.circle : BoxShape.rectangle,
            borderRadius: widget.circle ? null : BorderRadius.circular(widget.radius),
          ),
          child: DefaultTextStyle.merge(
            style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 14),
            child: IconTheme.merge(
              data: IconThemeData(color: fg),
              child: Center(widthFactor: 1, heightFactor: 1, child: widget.child),
            ),
          ),
        ),
      ),
    );
  }
}

/// Selectable pill: filled with the accent when selected.
class AppChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;
  final Color? _accent;
  Color get accent => _accent ?? DobhaColors.green;

  const AppChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
    this._accent,
  });

  @override
  Widget build(BuildContext context) {
    final fg = selected ? Colors.black : DobhaColors.textSecondary;
    return AppButton(
      onPressed: onTap,
      color: selected ? accent : null,
      radius: 20,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 14, color: fg), const SizedBox(width: 6)],
          Text(label, style: TextStyle(color: fg, fontSize: 12, fontWeight: selected ? FontWeight.w800 : FontWeight.w600)),
        ],
      ),
    );
  }
}

/// Small label, e.g. condition, status or a LIVE tag.
class AppTag extends StatelessWidget {
  final String text;
  final Color? _color;
  final IconData? icon;
  final bool solid;
  Color get color => _color ?? DobhaColors.textSecondary;

  const AppTag(this.text, {super.key, this._color, this.icon, this.solid = false});

  @override
  Widget build(BuildContext context) {
    final fg = solid ? Colors.white : color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: solid ? color : color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 11, color: fg), const SizedBox(width: 4)],
          Text(text, style: TextStyle(color: fg, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.3)),
        ],
      ),
    );
  }
}

/// Solid translucent panel for content laid over photos and video.
class OverlayPanel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;

  const OverlayPanel({super.key, required this.child, this.padding = const EdgeInsets.all(12), this.radius = 16});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(radius)),
      child: DefaultTextStyle.merge(
        style: const TextStyle(color: Colors.white),
        child: IconTheme.merge(data: const IconThemeData(color: Colors.white), child: child),
      ),
    );
  }
}

/// Round translucent icon button for overlays on photos and video.
class OverlayIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final Color color;
  final String tooltip;
  final double size;

  const OverlayIconButton({
    super.key,
    required this.icon,
    required this.onTap,
    required this.tooltip,
    this.color = Colors.white,
    this.size = 24,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.black.withValues(alpha: 0.45),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap == null
              ? null
              : () {
                  HapticFeedback.selectionClick();
                  onTap!();
                },
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Icon(icon, size: size, color: onTap == null ? color.withValues(alpha: 0.4) : color),
          ),
        ),
      ),
    );
  }
}
