import 'package:flutter/material.dart';

import '../api.dart';
import '../models/social.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/item_grid_tile.dart';
import '../widgets/ui.dart';
import '../widgets/user_avatar.dart';
import 'chat_screens.dart';
import 'feed_screen.dart';
import 'people_screens.dart';

/// Anyone's profile. Sellers also show their rating, listings and what buyers said.
class SellerScreen extends StatefulWidget {
  final String userId;
  const SellerScreen({super.key, required this.userId});

  static Future<void> open(BuildContext context, String userId) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => SellerScreen(userId: userId)));

  @override
  State<SellerScreen> createState() => _SellerScreenState();
}

class _SellerScreenState extends State<SellerScreen> {
  SellerProfile? _profile;
  List<ThriftItem> _items = const [];
  List<Review> _reviews = const [];
  String? _error;
  bool _following = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final (profile, items, reviews) = await AppState().loadProfile(widget.userId);
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _items = items;
        _reviews = reviews;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _toggleFollow() async {
    final p = _profile!;
    setState(() => _following = true);
    try {
      final updated = await AppState().setFollowing(p.id, !p.isFollowing);
      if (!mounted) return;
      setState(() => _profile = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            updated.isFollowing
                ? (p.isVendor
                      ? 'You will hear when ${p.displayName} lists something new'
                      : 'Following ${p.displayName}')
                : 'Unfollowed',
          ),
        ),
      );
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _following = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _profile;
    return Scaffold(
      appBar: AppBar(title: Text(p?.displayName ?? '')),
      body: p == null
          ? Center(
              child: _error == null
                  ? CircularProgressIndicator(color: DobhaColors.green)
                  : Text(_error!, style: TextStyle(color: DobhaColors.muted)),
            )
          : RefreshIndicator(
              color: DobhaColors.green,
              backgroundColor: DobhaColors.cardElevated,
              onRefresh: _load,
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(child: _header(p)),
                  if (p.isVendor || _items.isNotEmpty) ...[
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
                      sliver: SliverToBoxAdapter(
                        child: Text(
                          'For sale (${_items.length})',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: -0.3),
                        ),
                      ),
                    ),
                    if (_items.isEmpty)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text('Nothing for sale right now.', style: TextStyle(color: DobhaColors.muted)),
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        sliver: SliverGrid.builder(
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            mainAxisSpacing: 20,
                            crossAxisSpacing: 12,
                            childAspectRatio: 0.62,
                          ),
                          itemCount: _items.length,
                          itemBuilder: (context, i) => ItemGridTile(
                            item: _items[i],
                            index: i,
                            onTap: () => ItemDetailScreen.open(context, _items[i]),
                          ),
                        ),
                      ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 28, 16, 12),
                      sliver: SliverToBoxAdapter(
                        child: Text(
                          'Reviews (${p.reviewCount})',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: -0.3),
                        ),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                      sliver: _reviews.isEmpty
                          ? SliverToBoxAdapter(
                              child: Text('No reviews yet.', style: TextStyle(color: DobhaColors.muted)),
                            )
                          : SliverList.separated(
                              itemCount: _reviews.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 10),
                              itemBuilder: (context, i) => _ReviewTile(_reviews[i]),
                            ),
                    ),
                  ] else
                    const SliverToBoxAdapter(child: SizedBox(height: 32)),
                ],
              ),
            ),
    );
  }

  Widget _header(SellerProfile p) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: AppCard(
        radius: 20,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                UserAvatar(url: p.avatarUrl, name: p.name, size: 64),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p.displayName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                      Text(
                        p.followsYou && !p.isMe ? '${p.handle} · Follows you' : p.handle,
                        style: TextStyle(color: DobhaColors.muted, fontSize: 13),
                      ),
                      if (p.stallLocation.isNotEmpty)
                        Text(p.stallLocation, style: TextStyle(color: DobhaColors.textSecondary, fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
            if (p.bio.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(p.bio, style: TextStyle(color: DobhaColors.textSecondary, height: 1.4)),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                _Stat(
                  '${p.followerCount}',
                  'Followers',
                  onTap: () => FollowListScreen.open(context, userId: p.id, name: p.displayName),
                ),
                _Stat(
                  '${p.followingCount}',
                  'Following',
                  onTap: () => FollowListScreen.open(context, userId: p.id, name: p.displayName, following: true),
                ),
                if (p.isVendor) ...[
                  _Stat(
                    p.rating == null ? 'New' : p.rating!.toStringAsFixed(1),
                    p.rating == null ? 'No ratings' : '${p.reviewCount} ratings',
                    icon: p.rating == null ? null : Icons.star_rounded,
                  ),
                  _Stat('${p.salesCount}', 'Sales'),
                ],
              ],
            ),
            if (!p.isMe) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      color: p.isFollowing ? null : DobhaColors.green,
                      onPressed: _following ? null : _toggleFollow,
                      child: Text(p.isFollowing ? 'Following' : (p.followsYou ? 'Follow back' : 'Follow')),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppButton(
                      onPressed: () => ChatScreen.open(context, userId: p.id, name: p.displayName),
                      child: const Text('Message'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String value;
  final String label;
  final IconData? icon;
  final VoidCallback? onTap;
  const _Stat(this.value, this.label, {this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Column(
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[Icon(icon, size: 16, color: DobhaColors.green), const SizedBox(width: 3)],
                Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
              ],
            ),
            Text(label, style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
          ],
        ),
      ),
    );
  }
}

class _ReviewTile extends StatelessWidget {
  final Review review;
  const _ReviewTile(this.review);

  @override
  Widget build(BuildContext context) {
    return AppCard(
      radius: 16,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StarRow(rating: review.rating, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  review.buyerName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            ],
          ),
          if (review.text.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(review.text, style: TextStyle(color: DobhaColors.textSecondary, height: 1.4)),
          ],
          const SizedBox(height: 6),
          Text('Bought ${review.itemTitle}', style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
        ],
      ),
    );
  }
}

/// Five stars, filled up to [rating].
class StarRow extends StatelessWidget {
  final int rating;
  final double size;
  const StarRow({super.key, required this.rating, this.size = 18});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$rating out of 5 stars',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 1; i <= 5; i++)
            Icon(
              i <= rating ? Icons.star_rounded : Icons.star_outline_rounded,
              size: size,
              color: i <= rating ? DobhaColors.green : DobhaColors.muted,
            ),
        ],
      ),
    );
  }
}
