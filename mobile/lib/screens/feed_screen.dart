import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/checkout_modal.dart';
import '../widgets/live_now_row.dart';
import '../widgets/media_carousel.dart';
import '../widgets/offer_card.dart';
import '../widgets/user_avatar.dart';
import '../widgets/ui.dart';
import 'cart_screen.dart';
import 'chat_screens.dart';
import 'seller_screen.dart';
import 'studio_screen.dart';

/// Adds the piece to the cart, or takes it out again.
Future<void> toggleCart(BuildContext context, ThriftItem item) async {
  // The details sheet may close before the snackbar button is tapped, so hold on to these.
  final messenger = ScaffoldMessenger.of(context);
  final navigator = Navigator.of(context);
  HapticFeedback.selectionClick();
  try {
    if (item.inCart) {
      await AppState().removeFromCart(item.id);
      messenger.showSnackBar(const SnackBar(content: Text('Removed from your cart')));
    } else {
      await AppState().addToCart(item);
      messenger.showSnackBar(SnackBar(
        content: const Text('Added to your cart'),
        action: SnackBarAction(
          label: 'View',
          onPressed: () => navigator.push(MaterialPageRoute(builder: (_) => const CartScreen())),
        ),
      ));
    }
  } on ApiException catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(e.message)));
  }
}

/// "Shop name · 4.8" (or just the name before anyone has rated them).
String sellerLine(ThriftItem item) =>
    item.sellerRating == null ? item.sellerName : '${item.sellerName} · ${item.sellerRating!.toStringAsFixed(1)} stars';

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
              // Top of Home: who is live right now (when anyone is), and the cart.
              const SafeArea(
                child: Align(
                  alignment: Alignment.topCenter,
                  child: Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: LiveNowRow()),
                        Padding(padding: EdgeInsets.only(right: 12), child: CartButton(overlay: true)),
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
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
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
        // Soft fades top and bottom keep the text over the photo readable without boxes.
        const PhotoScrim(top: true),
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
            padding: const EdgeInsets.fromLTRB(16, 0, 10, 14),
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
        Semantics(
          button: true,
          label: 'Open ${item.sellerName}\'s shop',
          excludeSemantics: true,
          child: GestureDetector(
            onTap: () => SellerScreen.open(context, item.sellerId),
            child: Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(color: DobhaColors.green, shape: BoxShape.circle),
              child: UserAvatar(url: item.sellerAvatarUrl, name: item.sellerName, size: 46),
            ),
          ),
        ),
        const SizedBox(height: 20),
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
              child: Text('Report this listing', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17, letterSpacing: -0.3)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text('It will be hidden for you and reviewed by the Dobha team.',
                  style: TextStyle(fontSize: 13, color: DobhaColors.muted)),
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
    const shadow = [Shadow(color: Colors.black45, blurRadius: 8)];
    final meta = ['Size ${item.size}', item.condition, item.stockLabel].where((s) => s.isNotEmpty).join('  ·  ');
    return DefaultTextStyle.merge(
      style: const TextStyle(color: Colors.white, shadows: shadow),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            onTap: () => ItemInfoSheet.show(context, item),
            behavior: HitTestBehavior.opaque,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: () => SellerScreen.open(context, item.sellerId),
                  child: Text(
                    sellerLine(item),
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white.withValues(alpha: 0.85)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(height: 4),
                Text(item.title,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, height: 1.2, letterSpacing: -0.4),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Text(meta,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, color: Colors.white.withValues(alpha: 0.75))),
                const SizedBox(height: 10),
                Text(item.formattedPrice,
                    style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, letterSpacing: -0.8, height: 1.1)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          DefaultTextStyle.merge(
            style: const TextStyle(shadows: []),
            child: Row(
              children: [
                Expanded(
                  child: AppButton(
                    color: isMine ? Colors.white : DobhaColors.green,
                    radius: 14,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 15),
                    onPressed: isMine ? () => NewListingScreen.open(context, editing: item) : () => CheckoutModal.show(context, item),
                    child: Text(isMine ? 'Edit listing' : 'Buy now'),
                  ),
                ),
                if (!isMine) ...[
                  const SizedBox(width: 10),
                  Semantics(
                    label: item.inCart ? 'Remove from cart' : 'Add to cart',
                    child: _GlassButton(
                      onTap: () => toggleCart(context, item),
                      child: Icon(item.inCart ? Icons.shopping_bag_rounded : Icons.shopping_bag_outlined,
                          size: 22, color: item.inCart ? DobhaColors.green : Colors.white),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Square translucent button that sits next to Buy over the photo.
class _GlassButton extends StatelessWidget {
  final Widget child;
  final VoidCallback onTap;
  const _GlassButton({required this.child, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Colors.white.withValues(alpha: 0.22)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: SizedBox(width: 52, height: 52, child: Center(child: child)),
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
    return ListenableBuilder(listenable: AppState(), builder: (context, _) => _build(context));
  }

  Widget _build(BuildContext context) {
    final state = AppState();
    final item = [...state.feedItems, ...state.searchResults, ...state.savedItems, ...state.cart]
            .where((i) => i.id == this.item.id)
            .firstOrNull ??
        this.item;
    final isMine = state.user.id == item.sellerId;
    Widget row(String label, String value) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 92, child: Text(label, style: TextStyle(color: DobhaColors.muted, fontSize: 14))),
              Expanded(child: Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
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
              Text(item.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
              const SizedBox(height: 4),
              Text(item.formattedPrice, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: DobhaColors.green, letterSpacing: -0.3)),
              if (item.originalPriceZar != null)
                Text('Was ${item.formattedOriginalPrice}',
                    style: TextStyle(fontSize: 13, color: DobhaColors.muted, decoration: TextDecoration.lineThrough)),
              if (item.haulCaption.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(item.haulCaption, style: TextStyle(fontSize: 14, color: DobhaColors.textSecondary, height: 1.4)),
              ],
              const SizedBox(height: 16),
              row('Size', item.size),
              if (item.quantity > 1) row('In stock', '${item.quantity}'),
              row('Condition', item.condition),
              row('Category', item.category),
              if (item.sellerLocation.isNotEmpty) row('Stall', item.sellerLocation),
              const SizedBox(height: 4),
              AppCard(
                radius: 14,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                onTap: () {
                  Navigator.of(context).pop();
                  SellerScreen.open(context, item.sellerId);
                },
                child: Row(
                  children: [
                    UserAvatar(url: item.sellerAvatarUrl, name: item.sellerName, size: 36),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.sellerName, style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text(
                            item.sellerRating == null
                                ? 'No ratings yet'
                                : '${item.sellerRating!.toStringAsFixed(1)} stars from ${item.sellerReviewCount} buyers',
                            style: TextStyle(fontSize: 12, color: DobhaColors.muted),
                          ),
                        ],
                      ),
                    ),
                    Text('View shop', style: TextStyle(color: DobhaColors.green, fontWeight: FontWeight.w600, fontSize: 13)),
                  ],
                ),
              ),
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
                          style: TextStyle(fontSize: 13, color: DobhaColors.textSecondary, height: 1.35)),
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
                  child: Text('Buy for ${item.formattedPrice}', style: const TextStyle(fontSize: 15)),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: AppButton(
                        selected: item.inCart,
                        onPressed: () => toggleCart(context, item),
                        child: Text(item.inCart ? 'In your cart' : 'Add to cart'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: AppButton(
                        onPressed: () {
                          Navigator.of(context).pop();
                          makeOfferFlow(context, item);
                        },
                        child: const Text('Make an offer'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                TextButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                    ChatScreen.open(context, userId: item.sellerId, name: item.sellerName, about: item);
                  },
                  icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
                  label: const Text('Ask the seller a question'),
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
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, letterSpacing: -0.3)),
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
                GestureDetector(
                  onTap: comment.userId == null ? null : () => SellerScreen.open(context, comment.userId!),
                  child: Text(comment.handle, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                ),
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
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        children: [
          OverlayIconButton(icon: icon, color: iconColor, tooltip: tooltip, onTap: onTap, size: 26),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                shadows: [Shadow(color: Colors.black54, blurRadius: 6)],
              )),
        ],
      ),
    );
  }
}
