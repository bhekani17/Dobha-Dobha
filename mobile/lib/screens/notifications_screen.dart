import 'package:flutter/material.dart';

import '../api.dart';
import '../models/app_notification.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/ui.dart';

/// Sales, dispatches, payouts, disputes and comments, newest first. Opening it marks everything read.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  static Future<void> open(BuildContext context) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NotificationsScreen()));

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await AppState().loadNotifications();
      // Shown as unread this time; read from the next visit on.
      await AppState().markNotificationsRead();
    } on ApiException catch (e) {
      _error = e.message;
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ListenableBuilder(
        listenable: AppState(),
        builder: (context, _) {
          final items = AppState().notifications;
          if (_loading && items.isEmpty) {
            return Center(child: CircularProgressIndicator(color: DobhaColors.green));
          }
          if (_error != null && items.isEmpty) {
            return _Empty(icon: Icons.cloud_off_rounded, text: _error!, onRetry: _load);
          }
          if (items.isEmpty) {
            return const _Empty(
              icon: Icons.notifications_none_rounded,
              text: 'Nothing yet. Sales, deliveries and payouts will show up here.',
            );
          }
          return RefreshIndicator(
            color: DobhaColors.green,
            backgroundColor: DobhaColors.cardElevated,
            onRefresh: _load,
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) => _NotificationTile(items[i]),
            ),
          );
        },
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final AppNotification n;
  const _NotificationTile(this.n);

  static const _icons = {
    'sale': (Icons.sell_rounded, _Tone.green),
    'dispatched': (Icons.local_shipping_rounded, _Tone.cyan),
    'payout': (Icons.account_balance_wallet_rounded, _Tone.green),
    'disputed': (Icons.report_problem_rounded, _Tone.red),
    'resolved': (Icons.gavel_rounded, _Tone.amber),
    'removed': (Icons.block_rounded, _Tone.red),
    'comment': (Icons.chat_bubble_rounded, _Tone.muted),
    'offer': (Icons.local_offer_rounded, _Tone.green),
    'offer_accepted': (Icons.handshake_rounded, _Tone.green),
    'offer_countered': (Icons.swap_horiz_rounded, _Tone.green),
    'offer_declined': (Icons.do_not_disturb_on_outlined, _Tone.muted),
    'new_listing': (Icons.fiber_new_rounded, _Tone.green),
    'review': (Icons.star_rounded, _Tone.green),
    'follow': (Icons.person_add_alt_1_rounded, _Tone.green),
    'price_drop': (Icons.trending_down_rounded, _Tone.green),
  };

  @override
  Widget build(BuildContext context) {
    final (icon, tone) = _icons[n.kind] ?? (Icons.notifications_rounded, _Tone.muted);
    final color = tone.color;
    return AppCard(
      radius: 18,
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.16), shape: BoxShape.circle),
            child: Icon(icon, color: color, size: 19),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(n.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    ),
                    if (!n.read)
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(color: DobhaColors.green, shape: BoxShape.circle),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(n.body, style: TextStyle(fontSize: 12.5, color: DobhaColors.textSecondary, height: 1.35)),
                const SizedBox(height: 6),
                Text(_ago(n.createdAt), style: TextStyle(fontSize: 11, color: DobhaColors.muted)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _ago(DateTime t) {
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 1) return 'Just now';
    if (d.inHours < 1) return '${d.inMinutes} min ago';
    if (d.inDays < 1) return '${d.inHours} h ago';
    if (d.inDays < 7) return '${d.inDays} d ago';
    return '${t.day}/${t.month}/${t.year}';
  }
}

enum _Tone {
  green,
  cyan,
  red,
  amber,
  muted;

  Color get color => switch (this) {
        _Tone.green => DobhaColors.green,
        _Tone.cyan => DobhaColors.cyan,
        _Tone.red => DobhaColors.red,
        _Tone.amber => DobhaColors.amber,
        _Tone.muted => DobhaColors.muted,
      };
}

class _Empty extends StatelessWidget {
  final IconData icon;
  final String text;
  final VoidCallback? onRetry;
  const _Empty({required this.icon, required this.text, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: DobhaColors.muted),
            const SizedBox(height: 12),
            Text(text, textAlign: TextAlign.center, style: TextStyle(color: DobhaColors.muted)),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              AppButton(onPressed: onRetry, child: const Text('Try again')),
            ],
          ],
        ),
      ),
    );
  }
}

/// Bell button with an unread badge; opens [NotificationsScreen].
class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final unread = AppState().unreadNotifications;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            AppButton.icon(
              icon: unread > 0 ? Icons.notifications_rounded : Icons.notifications_none_rounded,
              size: 20,
              padding: 10,
              onPressed: () => NotificationsScreen.open(context),
            ),
            if (unread > 0)
              Positioned(
                right: -2,
                top: -2,
                child: IgnorePointer(
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 18),
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(color: DobhaColors.red, borderRadius: BorderRadius.circular(9)),
                    child: Text(
                      unread > 9 ? '9+' : '$unread',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
