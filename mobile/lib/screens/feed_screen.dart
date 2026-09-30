import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/checkout_modal.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final PageController _pageController = PageController();
  int _currentIndex = 0;

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
        final items = AppState().feedItems;

        if (items.isEmpty) {
          return const Center(child: Text('No thrift drops right now. Check back soon!'));
        }

        return Scaffold(
          body: Stack(
            children: [
              // Vertical Reels PageView
              PageView.builder(
                controller: _pageController,
                scrollDirection: Axis.vertical,
                onPageChanged: (idx) => setState(() => _currentIndex = idx),
                itemCount: items.length,
                itemBuilder: (context, index) {
                  return _ReelItemCard(item: items[index], isActive: index == _currentIndex);
                },
              ),

              // Top Bar Overlay
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.6),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: DobhaColors.borderLight.withValues(alpha: 0.5)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'DOBHA ',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5),
                            ),
                            Text(
                              'DIGITAL',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: DobhaColors.green, letterSpacing: 0.5),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      // In-app Escrow Trust Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: DobhaColors.escrowIndigo.withValues(alpha: 0.8),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.shield_rounded, size: 14, color: DobhaColors.cyan),
                            SizedBox(width: 4),
                            Text(
                              'Escrow Protected',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white),
                            ),
                          ],
                        ),
                      ),
                    ],
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

class _ReelItemCard extends StatefulWidget {
  final ThriftItem item;
  final bool isActive;

  const _ReelItemCard({required this.item, required this.isActive});

  @override
  State<_ReelItemCard> createState() => _ReelItemCardState();
}

class _ReelItemCardState extends State<_ReelItemCard> with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  bool _showHeartAnim = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _onDoubleTap() {
    HapticFeedback.lightImpact();
    setState(() => _showHeartAnim = true);
    AppState().toggleLike(widget.item.id);
    Future.delayed(const Duration(milliseconds: 700), () {
      if (mounted) setState(() => _showHeartAnim = false);
    });
  }

  Color _parseHex(String hex) {
    final clean = hex.replaceAll('#', '');
    return Color(int.parse('FF$clean', radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final color1 = item.gradientColorsHex.isNotEmpty ? _parseHex(item.gradientColorsHex[0]) : const Color(0xFF1E1E24);
    final color2 = item.gradientColorsHex.length > 1 ? _parseHex(item.gradientColorsHex[1]) : const Color(0xFF09090B);

    return GestureDetector(
      onDoubleTap: _onDoubleTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Dynamic Simulated Video Reel / Motion Aesthetic Background
          AnimatedBuilder(
            animation: _animController,
            builder: (context, _) {
              return Container(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment(0.0, -0.2 + (_animController.value * 0.1)),
                    radius: 1.2,
                    colors: [
                      color2.withValues(alpha: 0.9),
                      color1,
                      const Color(0xFF050507),
                    ],
                  ),
                ),
                child: Center(
                  child: Hero(
                    tag: 'item-${item.id}',
                    child: Container(
                      width: MediaQuery.of(context).size.width * 0.78,
                      height: MediaQuery.of(context).size.height * 0.48,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                        boxShadow: [
                          BoxShadow(
                            color: color1.withValues(alpha: 0.4),
                            blurRadius: 40,
                            spreadRadius: 10,
                          ),
                        ],
                      ),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          // Thrift Piece Graphic & Motif
                          Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                _categoryIcon(item.category),
                                size: 100,
                                color: Colors.white.withValues(alpha: 0.85),
                              ),
                              const SizedBox(height: 16),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: 0.5),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: DobhaColors.green.withValues(alpha: 0.5)),
                                ),
                                child: Text(
                                  item.haulCaption.isNotEmpty ? item.haulCaption : 'Fresh Joburg Thrift Drop',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white),
                                ),
                              ),
                            ],
                          ),

                          // Live Video Reel Indicator
                          Positioned(
                            top: 14,
                            left: 14,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.6),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Row(
                                children: [
                                  Icon(Icons.play_arrow_rounded, color: DobhaColors.green, size: 16),
                                  SizedBox(width: 4),
                                  Text('DOBHA REEL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: DobhaColors.green)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),

          // Double tap heart animation
          if (_showHeartAnim)
            Center(
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.5, end: 1.3),
                duration: const Duration(milliseconds: 400),
                builder: (context, scale, child) {
                  return Transform.scale(
                    scale: scale,
                    child: const Icon(Icons.favorite, color: DobhaColors.red, size: 100),
                  );
                },
              ),
            ),

          // Dark Gradient Scrim for readable overlays
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: [0.0, 0.5, 0.8, 1.0],
                  colors: [
                    Colors.black26,
                    Colors.transparent,
                    Colors.black54,
                    Colors.black,
                  ],
                ),
              ),
            ),
          ),

          // Right Sidebar Actions (Like, Comment, Save, Share, Sound Disc)
          Positioned(
            right: 14,
            bottom: 110,
            child: Column(
              children: [
                // Seller Avatar
                GestureDetector(
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Viewing seller profile: ${item.sellerName}')),
                    );
                  },
                  child: Stack(
                    alignment: Alignment.bottomCenter,
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: DobhaColors.green, width: 2),
                          color: DobhaColors.cardElevated,
                        ),
                        child: Center(
                          child: Text(
                            item.sellerName.substring(0, 2).toUpperCase(),
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                          ),
                        ),
                      ),
                      Positioned(
                        bottom: -6,
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: const BoxDecoration(
                            color: DobhaColors.green,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.add, size: 12, color: Colors.black),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Like Button
                _SidebarAction(
                  icon: item.isLiked ? Icons.favorite : Icons.favorite_border,
                  iconColor: item.isLiked ? DobhaColors.red : Colors.white,
                  label: '${item.likesCount}',
                  onTap: () {
                    HapticFeedback.lightImpact();
                    AppState().toggleLike(item.id);
                  },
                ),
                const SizedBox(height: 16),

                // Comments
                _SidebarAction(
                  icon: Icons.chat_bubble_outline_rounded,
                  label: '24',
                  onTap: () => _showCommentsSheet(context, item),
                ),
                const SizedBox(height: 16),

                // Save / Bookmark
                _SidebarAction(
                  icon: item.isSaved ? Icons.bookmark : Icons.bookmark_border,
                  iconColor: item.isSaved ? DobhaColors.gold : Colors.white,
                  label: 'Save',
                  onTap: () {
                    HapticFeedback.lightImpact();
                    AppState().toggleSave(item.id);
                  },
                ),
                const SizedBox(height: 16),

                // Share
                _SidebarAction(
                  icon: Icons.share_rounded,
                  label: 'Share',
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Sharing ${item.title} link')),
                    );
                  },
                ),
                const SizedBox(height: 16),

                // Spinning Vinyl Disc
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.black,
                    border: Border.all(color: DobhaColors.borderLight, width: 2),
                  ),
                  child: const Center(
                    child: Icon(Icons.music_note_rounded, size: 18, color: DobhaColors.green),
                  ),
                ),
              ],
            ),
          ),

          // Bottom Details & Instant "DOBHA / CLAIM NOW" Action Bar
          Positioned(
            left: 16,
            right: 80,
            bottom: 24,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Seller Handle & Badge
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        item.sellerHandle,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Colors.white),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: DobhaColors.gold.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        item.sellerBadge,
                        style: const TextStyle(color: DobhaColors.gold, fontSize: 10, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),

                // Seller Location
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 13, color: DobhaColors.muted),
                    const SizedBox(width: 4),
                    Text(
                      item.sellerLocation,
                      style: const TextStyle(fontSize: 12, color: DobhaColors.textSecondary),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Title & Condition Badges
                Text(
                  item.title,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white, height: 1.2),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 6),

                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: DobhaColors.cardElevated,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: DobhaColors.borderLight),
                      ),
                      child: Text(
                        '🏷️ ${item.condition}',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: DobhaColors.cyan),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: DobhaColors.cardElevated,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: DobhaColors.borderLight),
                      ),
                      child: Text(
                        'Size: ${item.size}',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: DobhaColors.textSecondary),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Price & Claim Button
                Row(
                  children: [
                    Text(
                      item.formattedPrice,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: DobhaColors.green,
                        letterSpacing: -0.5,
                      ),
                    ),
                    if (item.originalPriceZar != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        item.formattedOriginalPrice,
                        style: const TextStyle(
                          fontSize: 14,
                          color: DobhaColors.muted,
                          decoration: TextDecoration.lineThrough,
                        ),
                      ),
                    ],
                    const SizedBox(width: 14),
                    Expanded(
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: DobhaColors.green,
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () => CheckoutModal.show(context, item),
                        icon: const Icon(Icons.flash_on, size: 16),
                        label: const Text(
                          'DOBHA / CLAIM',
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _categoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'jackets':
        return Icons.dry_cleaning_rounded;
      case 'denim':
        return Icons.straighten_rounded;
      case 'sneakers':
        return Icons.skateboarding_rounded;
      case 'workwear':
        return Icons.handyman_rounded;
      case 'vintage tees':
        return Icons.checkroom_rounded;
      default:
        return Icons.local_offer_rounded;
    }
  }

  void _showCommentsSheet(BuildContext context, ThriftItem item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: DobhaColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Text('Live Comments (24)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const Spacer(),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(ctx).pop()),
              ],
            ),
            const Divider(color: DobhaColors.border),
            const ListTile(
              dense: true,
              leading: CircleAvatar(child: Text('K')),
              title: Text('Kabelo_99', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: Text('Is the zipper smooth or sticking? Clean find! 🔥'),
            ),
            const ListTile(
              dense: true,
              leading: CircleAvatar(child: Text('S')),
              title: Text('Sipho_Streetwear', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: Text('I can collect in Braamfontein today!'),
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: InputDecoration(
                hintText: 'Ask seller about fit or texture...',
                suffixIcon: IconButton(
                  icon: const Icon(Icons.send_rounded, color: DobhaColors.green),
                  onPressed: () => Navigator.of(ctx).pop(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SidebarAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color iconColor;

  const _SidebarAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.iconColor = Colors.white,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.4),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 28),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
