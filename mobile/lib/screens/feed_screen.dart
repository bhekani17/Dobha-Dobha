import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/checkout_modal.dart';
import '../widgets/media_carousel.dart';
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
          body: Stack(
            fit: StackFit.expand,
            children: [
              _body(state, items),
              // Top bar floats over the photo.
              SafeArea(
                bottom: false,
                child: Align(
                  alignment: Alignment.topCenter,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                    child: Row(
                      children: [
                        const OverlayPanel(
                          radius: 20,
                          padding: EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('DOBHA ', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5)),
                              Text('DIGITAL',
                                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: DobhaColors.green, letterSpacing: 0.5)),
                            ],
                          ),
                        ),
                        const Spacer(),
                        OverlayIconButton(
                          icon: Icons.refresh_rounded,
                          size: 20,
                          tooltip: 'Refresh',
                          onTap: state.feedLoading ? null : state.loadFeed,
                        ),
                      ],
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

  Widget _body(AppState state, List<ThriftItem> items) {
    if (items.isEmpty) {
      return ColoredBox(
        color: DobhaColors.bg,
        child: state.feedLoading
            ? const Center(child: CircularProgressIndicator(color: DobhaColors.green))
            : _FeedMessage(
                icon: state.feedError != null ? Icons.wifi_off_rounded : Icons.checkroom_rounded,
                title: state.feedError != null ? 'Could not load drops' : 'No drops yet',
                text: state.feedError ??
                    (state.isVendor
                        ? 'Be the first: list a piece from the Go Live tab.'
                        : 'Vendors have not listed anything yet. Check back soon.'),
                onRetry: state.loadFeed,
              ),
      );
    }
    return RefreshIndicator(
      color: DobhaColors.green,
      backgroundColor: DobhaColors.cardElevated,
      edgeOffset: MediaQuery.of(context).padding.top + 56,
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
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(text, textAlign: TextAlign.center, style: const TextStyle(color: DobhaColors.muted, height: 1.4)),
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

  const _ReelItemCard({required this.item, required this.active});

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
        GestureDetector(onDoubleTap: _onDoubleTap, child: MediaCarousel(item: item, active: widget.active)),
        if (_showHeartAnim)
          IgnorePointer(
            child: Center(
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.5, end: 1.3),
                duration: const Duration(milliseconds: 400),
                builder: (context, scale, child) => Transform.scale(
                  scale: scale,
                  child: const Icon(Icons.favorite, color: DobhaColors.red, size: 110),
                ),
              ),
            ),
          ),
        SafeArea(
          bottom: false,
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
          width: 48,
          height: 48,
          alignment: Alignment.center,
          decoration: const BoxDecoration(color: DobhaColors.green, shape: BoxShape.circle),
          child: Text(
            item.sellerName.substring(0, item.sellerName.length.clamp(1, 2)).toUpperCase(),
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.black),
          ),
        ),
        const SizedBox(height: 18),
        _SidebarAction(
          icon: item.isLiked ? Icons.favorite : Icons.favorite_border,
          iconColor: item.isLiked ? DobhaColors.red : Colors.white,
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
          icon: Icons.share_rounded,
          label: 'Share',
          tooltip: 'Share',
          onTap: () {
            Clipboard.setData(ClipboardData(text: '${item.title} (${item.formattedPrice}) from ${item.sellerName} on Dobha Dobha'));
            _snack('Copied to clipboard');
          },
        ),
      ],
    );
  }

  Widget _details(ThriftItem item) {
    final isMine = AppState().user.id == item.sellerId;
    return OverlayPanel(
      radius: 20,
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '${item.sellerName}  ${item.sellerHandle}',
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (item.sellerLocation.isNotEmpty)
            Row(
              children: [
                Icon(Icons.location_on_outlined, size: 12, color: Colors.white.withValues(alpha: 0.7)),
                const SizedBox(width: 2),
                Flexible(
                  child: Text(item.sellerLocation,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 11.5, color: Colors.white.withValues(alpha: 0.7))),
                ),
              ],
            ),
          const SizedBox(height: 8),
          Text(item.title,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, height: 1.2), maxLines: 2, overflow: TextOverflow.ellipsis),
          if (item.haulCaption.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(item.haulCaption,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.8), height: 1.3)),
          ],
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              AppTag(item.category, color: DobhaColors.green, solid: true),
              AppTag(item.condition, color: DobhaColors.cyan, icon: Icons.sell_outlined),
              AppTag('Size ${item.size}', color: Colors.white),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.formattedPrice,
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: DobhaColors.green, letterSpacing: -0.5)),
                  if (item.originalPriceZar != null)
                    Text(item.formattedOriginalPrice,
                        style: TextStyle(
                            fontSize: 12, color: Colors.white.withValues(alpha: 0.6), decoration: TextDecoration.lineThrough)),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppButton(
                  color: DobhaColors.green,
                  radius: 14,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
                  onPressed: isMine ? null : () => CheckoutModal.show(context, item),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.flash_on, size: 17),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(isMine ? 'YOUR LISTING' : 'DOBHA / CLAIM',
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
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
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
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
                            ? Text(_error!, style: const TextStyle(color: DobhaColors.muted))
                            : const CircularProgressIndicator(color: DobhaColors.green),
                      ),
                    )
                  : comments.isEmpty
                      ? const Padding(
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
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: DobhaColors.green))
                      : const Icon(Icons.send_rounded, color: DobhaColors.green),
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
                  style: const TextStyle(fontWeight: FontWeight.w800, color: DobhaColors.green)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(comment.handle, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                const SizedBox(height: 2),
                Text(comment.text, style: const TextStyle(color: DobhaColors.textSecondary, fontSize: 13)),
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
