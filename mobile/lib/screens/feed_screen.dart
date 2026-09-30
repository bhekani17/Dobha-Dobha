import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/checkout_modal.dart';
import '../widgets/media_carousel.dart';
import '../widgets/user_avatar.dart';
import '../widgets/ui.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final PageController _pageController = PageController();
  int _current = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final state = AppState();
        final items = state.feedItems;

        return Scaffold(
          backgroundColor: Colors.black,
          body: _body(state, items),
        );
      },
    );
  }

  Widget _body(AppState state, List<ThriftItem> items) {
    if (items.isEmpty) {
      return ColoredBox(
        color: DobhaColors.bg,
        child: state.feedLoading
            ? Center(child: CircularProgressIndicator(color: DobhaColors.green))
            : _FeedMessage(
                icon: state.feedError != null ? Icons.wifi_off_rounded : Icons.checkroom_rounded,
                title: state.feedError != null ? 'Could not load drops' : 'No drops yet',
                text: state.feedError ??
                    (state.isVendor
                        ? 'Be the first: list a piece from the Sell tab.'
                        : 'Sellers have not listed anything yet. Check back soon.'),
                onRetry: state.loadFeed,
              ),
      );
    }
    return RefreshIndicator(
      color: DobhaColors.green,
      backgroundColor: DobhaColors.cardElevated,
      edgeOffset: MediaQuery.of(context).padding.top,
      onRefresh: state.loadFeed,
      child: PageView.builder(
        controller: _pageController,
        scrollDirection: Axis.vertical,
        itemCount: items.length,
        onPageChanged: (i) => setState(() => _current = i),
        itemBuilder: (context, index) => _ReelItemCard(item: items[index], active: index == _current),
      ),
    );
  }
}

class _FeedMessage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String text;
  final VoidCallback onRetry;

  const _FeedMessage({required this.icon, required this.title, required this.text, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppWell(circle: true, padding: const EdgeInsets.all(22), child: Icon(icon, size: 40, color: DobhaColors.muted)),
            const SizedBox(height: 18),
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(text, textAlign: TextAlign.center, style: TextStyle(color: DobhaColors.muted, height: 1.4)),
            const SizedBox(height: 20),
            AppButton(onPressed: onRetry, child: const Text('Refresh')),
          ],
        ),
      ),
    );
  }
}

class _ReelItemCard extends StatefulWidget {
  final ThriftItem item;
  final bool active;

  /// Set when opened from a grid tile, so the photo flies in from the tile.
  final String? heroTag;

  const _ReelItemCard({required this.item, required this.active, this.heroTag});

  @override
  State<_ReelItemCard> createState() => _ReelItemCardState();
}

class _ReelItemCardState extends State<_ReelItemCard> {
  bool _showHeartAnim = false;

  void _snack(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
    } on ApiException catch (e) {
      if (mounted) _snack(e.message);
    }
  }

  void _onDoubleTap() {
    HapticFeedback.lightImpact();
    setState(() => _showHeartAnim = true);
    if (!widget.item.isLiked) _run(() => AppState().toggleLike(widget.item.id));
    Future.delayed(const Duration(milliseconds: 700), () {
      if (mounted) setState(() => _showHeartAnim = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Photos and videos fill the whole page; swipe sideways between them, double tap to like.
        GestureDetector(
          onDoubleTap: _onDoubleTap,
          child: widget.heroTag == null
              ? MediaCarousel(item: item, active: widget.active)
              : Hero(tag: widget.heroTag!, child: MediaCarousel(item: item, active: widget.active)),
        ),
        if (_showHeartAnim)
          IgnorePointer(
            child: Center(
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.5, end: 1.3),
                duration: const Duration(milliseconds: 400),
                builder: (context, scale, child) => Transform.scale(
                  scale: scale,
                  child: Icon(Icons.favorite, color: DobhaColors.green, size: 110),
                ),
              ),
            ),
          ),
        SafeArea(
          // In the feed the nav bar sits below; full-screen detail needs the bottom inset.
          bottom: widget.heroTag != null,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(child: _details(item)),
                const SizedBox(width: 12),
                _sideActions(item),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _sideActions(ThriftItem item) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(color: DobhaColors.green, shape: BoxShape.circle),
          child: UserAvatar(url: item.sellerAvatarUrl, name: item.sellerName, size: 46),
        ),
        const SizedBox(height: 18),
        _SidebarAction(
          icon: item.isLiked ? Icons.favorite : Icons.favorite_border,
          iconColor: item.isLiked ? DobhaColors.green : Colors.white,
          label: '${item.likesCount}',
          tooltip: item.isLiked ? 'Unlike' : 'Like',
          onTap: () {
            HapticFeedback.lightImpact();
            _run(() => AppState().toggleLike(item.id));
          },
        ),
        _SidebarAction(
          icon: Icons.chat_bubble_outline_rounded,
          label: '${item.commentsCount}',
          tooltip: 'Comments',
          onTap: () => CommentsSheet.show(context, item),
        ),
        _SidebarAction(
          icon: item.isSaved ? Icons.bookmark : Icons.bookmark_border,
          iconColor: item.isSaved ? DobhaColors.gold : Colors.white,
          label: item.isSaved ? 'Saved' : 'Save',
          tooltip: item.isSaved ? 'Remove from saved' : 'Save',
          onTap: () {
            HapticFeedback.lightImpact();
            _run(() => AppState().toggleSave(item.id));
          },
        ),
        _SidebarAction(
          icon: Icons.more_horiz_rounded,
          label: 'More',
          tooltip: 'More options',
          onTap: () => _more(item),
        ),
      ],
    );
  }

  Future<void> _more(ThriftItem item) async {
    final isMine = item.sellerId == AppState().user.id;
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: DobhaColors.surface,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.info_outline_rounded),
              title: const Text('Details'),
              onTap: () => Navigator.of(ctx).pop('details'),
            ),
            ListTile(
              leading: const Icon(Icons.link_rounded),
              title: const Text('Copy to share'),
              onTap: () => Navigator.of(ctx).pop('share'),
            ),
            if (!isMine)
              ListTile(
                leading: Icon(Icons.flag_outlined, color: DobhaColors.red),
                title: Text('Report listing', style: TextStyle(color: DobhaColors.red)),
                onTap: () => Navigator.of(ctx).pop('report'),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (!mounted) return;
    switch (choice) {
      case 'details':
        ItemInfoSheet.show(context, item);
      case 'share':
        Clipboard.setData(ClipboardData(text: '${item.title} (${item.formattedPrice}) from ${item.sellerName} on Dobha Dobha'));
        _snack('Copied, paste it anywhere to share');
      case 'report':
        _report(item);
    }
  }

  Future<void> _report(ThriftItem item) async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: DobhaColors.surface,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
              child: Text('Report this listing', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text('It will be hidden for you and reviewed by the Dobha team.',
                  style: TextStyle(fontSize: 12.5, color: DobhaColors.muted)),
            ),
            for (final r in AppState.reportReasons)
              ListTile(
                title: Text(r, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                trailing: Icon(Icons.chevron_right_rounded, color: DobhaColors.muted),
                onTap: () => Navigator.of(ctx).pop(r),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (reason == null || !mounted) return;
    // This card is removed from the feed once the report goes through, so hold on to these first.
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final fullScreen = widget.heroTag != null;
    try {
      await AppState().reportItem(item.id, reason);
      messenger.showSnackBar(const SnackBar(content: Text('Thanks, the Dobha team will review it')));
      // Opened full screen from a grid: the listing is gone for this user, so leave it.
      if (fullScreen && navigator.canPop()) navigator.pop();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Widget _details(ThriftItem item) {
    final isMine = AppState().user.id == item.sellerId;
    return GestureDetector(
      onTap: () => ItemInfoSheet.show(context, item),
      child: OverlayPanel(
        radius: 20,
        padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              item.sellerName,
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: Colors.white.withValues(alpha: 0.75)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(item.title,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, height: 1.2),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
            const SizedBox(height: 3),
            Text('Size ${item.size} · ${item.condition}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.75))),
            const SizedBox(height: 12),
            Row(
              children: [
                Text(item.formattedPrice,
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: DobhaColors.green, letterSpacing: -0.5)),
                const SizedBox(width: 12),
                Expanded(
                  child: AppButton(
                    color: isMine ? null : DobhaColors.green,
                    radius: 14,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
                    onPressed: isMine ? null : () => CheckoutModal.show(context, item),
                    child: Text(isMine ? 'Your listing' : 'Buy', style: const TextStyle(fontSize: 15)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Everything about a listing: shown when the info panel is tapped.
class ItemInfoSheet extends StatelessWidget {
  final ThriftItem item;
  const ItemInfoSheet({super.key, required this.item});

  static Future<void> show(BuildContext context, ThriftItem item) => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: DobhaColors.surface,
        showDragHandle: true,
        builder: (_) => ItemInfoSheet(item: item),
      );

  @override
  Widget build(BuildContext context) {
    final isMine = AppState().user.id == item.sellerId;
    Widget row(String label, String value) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 92, child: Text(label, style: TextStyle(color: DobhaColors.muted, fontSize: 13.5))),
              Expanded(child: Text(value, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600))),
            ],
          ),
        );
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.8),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(item.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(item.formattedPrice, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: DobhaColors.green)),
              if (item.originalPriceZar != null)
                Text('Was ${item.formattedOriginalPrice}',
                    style: TextStyle(fontSize: 13, color: DobhaColors.muted, decoration: TextDecoration.lineThrough)),
              if (item.haulCaption.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(item.haulCaption, style: TextStyle(fontSize: 14, color: DobhaColors.textSecondary, height: 1.4)),
              ],
              const SizedBox(height: 16),
              row('Size', item.size),
              row('Condition', item.condition),
              row('Category', item.category),
              row('Seller', '${item.sellerName} (${item.sellerHandle})'),
              if (item.sellerLocation.isNotEmpty) row('Stall', item.sellerLocation),
              if (item.description.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(item.description, style: TextStyle(fontSize: 14, color: DobhaColors.textSecondary, height: 1.45)),
              ],
              const SizedBox(height: 14),
              AppWell(
                radius: 14,
                child: Row(
                  children: [
                    Icon(Icons.verified_user_outlined, size: 18, color: DobhaColors.green),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text('We hold your payment and only pay the seller once you have the piece.',
                          style: TextStyle(fontSize: 12.5, color: DobhaColors.textSecondary, height: 1.35)),
                    ),
                  ],
                ),
              ),
              if (!isMine) ...[
                const SizedBox(height: 16),
                AppButton(
                  color: DobhaColors.green,
                  onPressed: () {
                    Navigator.of(context).pop();
                    CheckoutModal.show(context, item);
                  },
                  child: const Text('Buy', style: TextStyle(fontSize: 15)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// One listing full screen, opened from a grid (Explore). Stays in sync with
/// likes and saves made here or elsewhere.
class ItemDetailScreen extends StatelessWidget {
  final ThriftItem item;
  const ItemDetailScreen({super.key, required this.item});

  static Future<void> open(BuildContext context, ThriftItem item) {
    return Navigator.of(context).push(PageRouteBuilder(
      transitionDuration: const Duration(milliseconds: 320),
      reverseTransitionDuration: const Duration(milliseconds: 260),
      pageBuilder: (_, _, _) => ItemDetailScreen(item: item),
      transitionsBuilder: (_, animation, _, child) => FadeTransition(opacity: animation, child: child),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final state = AppState();
        final latest = [...state.feedItems, ...state.searchResults, ...state.savedItems, ...state.vendorInventory]
                .where((i) => i.id == item.id)
                .firstOrNull ??
            item;
        return Scaffold(
          backgroundColor: Colors.black,
          body: Stack(
            fit: StackFit.expand,
            children: [
              _ReelItemCard(item: latest, active: true, heroTag: 'item-${item.id}'),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Align(
                    alignment: Alignment.topLeft,
                    child: OverlayIconButton(
                      icon: Icons.arrow_back_rounded,
                      size: 22,
                      tooltip: 'Back',
                      onTap: () => Navigator.of(context).pop(),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Comments on an item, loaded from the server.
class CommentsSheet extends StatefulWidget {
  final ThriftItem item;
  const CommentsSheet({super.key, required this.item});

  static Future<void> show(BuildContext context, ThriftItem item) {
    return showModalBottomSheet(context: context, isScrollControlled: true, builder: (_) => CommentsSheet(item: item));
  }

  @override
  State<CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends State<CommentsSheet> {
  final _ctrl = TextEditingController();
  List<ItemComment>? _comments;
  String? _error;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await AppState().comments(widget.item.id);
      if (mounted) setState(() => _comments = list);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final c = await AppState().addComment(widget.item.id, text);
      _ctrl.clear();
      if (mounted) setState(() => _comments = [c, ...?_comments]);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final comments = _comments;
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.7),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text('Comments${comments == null ? '' : ' (${comments.length})'}',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const Spacer(),
                AppButton.icon(icon: Icons.close, size: 18, padding: 8, onPressed: () => Navigator.of(context).pop()),
              ],
            ),
            const SizedBox(height: 16),
            Flexible(
              child: comments == null
                  ? Padding(
                      padding: const EdgeInsets.all(24),
                      child: Center(
                        child: _error != null
                            ? Text(_error!, style: TextStyle(color: DobhaColors.muted))
                            : CircularProgressIndicator(color: DobhaColors.green),
                      ),
                    )
                  : comments.isEmpty
                      ? Padding(
                          padding: EdgeInsets.all(24),
                          child: Text('No comments yet. Ask the seller about fit or condition.',
                              textAlign: TextAlign.center, style: TextStyle(color: DobhaColors.muted)),
                        )
                      : ListView(shrinkWrap: true, children: [for (final c in comments) _Comment(comment: c)]),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _ctrl,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _send(),
              decoration: InputDecoration(
                hintText: 'Ask the seller about fit or condition...',
                suffixIcon: IconButton(
                  icon: _sending
                      ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: DobhaColors.green))
                      : Icon(Icons.send_rounded, color: DobhaColors.green),
                  onPressed: _send,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Comment extends StatelessWidget {
  final ItemComment comment;

  const _Comment({required this.comment});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppWell(
            circle: true,
            width: 38,
            height: 38,
            padding: EdgeInsets.zero,
            child: Center(
              child: Text(comment.name.isEmpty ? '?' : comment.name[0].toUpperCase(),
                  style: TextStyle(fontWeight: FontWeight.w700, color: DobhaColors.green)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(comment.handle, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 2),
                Text(comment.text, style: TextStyle(color: DobhaColors.textSecondary, fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SidebarAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final String tooltip;
  final VoidCallback onTap;
  final Color iconColor;

  const _SidebarAction({
    required this.icon,
    required this.label,
    required this.tooltip,
    required this.onTap,
    this.iconColor = Colors.white,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        children: [
          OverlayIconButton(icon: icon, color: iconColor, tooltip: tooltip, onTap: onTap),
          const SizedBox(height: 4),
          OverlayPanel(
            radius: 8,
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}
