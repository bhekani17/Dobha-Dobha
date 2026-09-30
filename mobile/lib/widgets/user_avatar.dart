import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme.dart';

/// A round profile picture, or the person's initials when they have none.
class UserAvatar extends StatelessWidget {
  final String? url;
  final String name;
  final double size;

  const UserAvatar({super.key, required this.url, required this.name, this.size = 48});

  static String initialsOf(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, parts.first.length.clamp(1, 2)).toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      alignment: Alignment.center,
      color: Color.alphaBlend(DobhaColors.green.withValues(alpha: 0.18), DobhaColors.well),
      child: Text(
        initialsOf(name),
        style: TextStyle(fontWeight: FontWeight.w900, fontSize: size * 0.34, color: DobhaColors.green),
      ),
    );
    return SizedBox(
      width: size,
      height: size,
      child: ClipOval(
        child: url == null
            ? fallback
            : Image.network(
                AppState().api.resolve(url!),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => fallback,
                loadingBuilder: (context, child, progress) => progress == null ? child : fallback,
              ),
      ),
    );
  }
}
