import 'package:flutter/material.dart';

import '../models/escrow_order.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/checkout_modal.dart';
import '../widgets/escrow_tracker_badge.dart';
import '../widgets/item_photo.dart';
import '../widgets/ui.dart';
import '../widgets/user_avatar.dart';
import 'account_sheets.dart';
import 'edit_profile_screen.dart';
import 'chat_screens.dart';
import 'notifications_screen.dart';
import 'people_screens.dart';
import 'settings_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController = TabController(length: 2, vsync: this);


  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final appState = AppState();
        if (!appState.isLoggedIn) return const SizedBox.shrink();
        final user = appState.user;
        final orders = appState.orders;
        final saved = appState.savedItems;

        return Scaffold(
          appBar: AppBar(
            toolbarHeight: 68,
            title: const Text('Me'),
            actions: [
              const MessagesButton(),
              const SizedBox(width: 12),
              const NotificationBell(),
              const SizedBox(width: 12),
              AppButton.icon(icon: Icons.settings_outlined, size: 19, padding: 10, onPressed: () => SettingsScreen.open(context)),
              const SizedBox(width: 16),
            ],
          ),
          body: NestedScrollView(
            headerSliverBuilder: (context, _) => [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 18),
                  child: Column(
                      children: [
                        Row(
                          children: [
                            GestureDetector(
                              onTap: () => EditProfileScreen.open(context),
                              child: UserAvatar(url: user.avatarUrl, name: user.name, size: 76),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(user.name,
                                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 22, letterSpacing: -0.5),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis),
                                  Text(user.handle, style: TextStyle(fontSize: 13, color: DobhaColors.muted)),
                                  const SizedBox(height: 4),
                                  if (user.location.isNotEmpty)
                                    Row(
                                      children: [
                                        Icon(Icons.location_on_outlined, size: 12, color: DobhaColors.textSecondary),
                                        const SizedBox(width: 2),
                                        Flexible(
                                          child: Text(user.location,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(fontSize: 12, color: DobhaColors.textSecondary)),
                                        ),
                                      ],
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: user.bio.isNotEmpty
                              ? Text(user.bio, style: const TextStyle(fontSize: 14, height: 1.45))
                              : GestureDetector(
                                  onTap: () => EditProfileScreen.open(context),
                                  child: Text('Add a bio so buyers and sellers know you',
                                      style: TextStyle(fontSize: 13, color: DobhaColors.green, fontWeight: FontWeight.w600)),
                                ),
                        ),
                        const SizedBox(height: 18),
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            border: Border.symmetric(horizontal: BorderSide(color: DobhaColors.border)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              _Stat(
                                label: 'Followers',
                                value: '${appState.followerCount}',
                                onTap: () => FollowListScreen.open(context, userId: user.id, name: user.name),
                              ),
                              _Stat(
                                label: 'Following',
                                value: '${appState.followingCount}',
                                onTap: () => FollowListScreen.open(context, userId: user.id, name: user.name, following: true),
                              ),
                              _Stat(label: 'Purchases', value: '${orders.where((o) => !o.isSeller).length}'),
                              _Stat(label: 'Sales', value: '${user.salesCount}'),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                user.isVendor ? 'Selling as ${user.shopName}' : 'Want to sell your own pieces?',
                                style: TextStyle(fontSize: 13, color: DobhaColors.textSecondary, fontWeight: FontWeight.w600),
                              ),
                            ),
                            AppButton(
                              radius: 14,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                              onPressed: () => user.isVendor ? switchToShopper(context) : showBecomeVendorSheet(context),
                              child: Text(user.isVendor ? 'Switch to Shopper' : 'Start Selling',
                                  style: TextStyle(fontSize: 12, color: user.isVendor ? DobhaColors.textSecondary : DobhaColors.green)),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
              ),
              SliverPersistentHeader(
                pinned: true,
                delegate: _TabsDelegate(
                  TabBar(
                    controller: _tabController,
                    indicator: UnderlineTabIndicator(borderSide: BorderSide(color: DobhaColors.text, width: 2)),
                    indicatorSize: TabBarIndicatorSize.tab,
                    labelColor: DobhaColors.text,
                    unselectedLabelColor: DobhaColors.muted,
                    labelStyle: const TextStyle(fontFamily: DobhaColors.fontFamily, fontWeight: FontWeight.w600, fontSize: 14),
                    unselectedLabelStyle: const TextStyle(fontFamily: DobhaColors.fontFamily, fontWeight: FontWeight.w500, fontSize: 14),
                    tabs: [
                      Tab(text: 'Orders (${orders.length})'),
                      Tab(text: 'Saved (${saved.length})'),
                    ],
                  ),
                ),
              ),
            ],
            body: TabBarView(
              controller: _tabController,
              children: [
                _buildOrdersTab(orders),
                _buildSavedTab(context, saved),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildOrdersTab(List<EscrowOrder> orders) {
    if (orders.isEmpty) {
      return const _Empty(icon: Icons.receipt_long_outlined, text: 'No orders yet. Buy a piece from Home and it shows up here.');
    }
    return RefreshIndicator(
      color: DobhaColors.green,
      backgroundColor: DobhaColors.cardElevated,
      onRefresh: AppState().loadOrders,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
        itemCount: orders.length,
        itemBuilder: (context, idx) => EscrowTrackerCard(order: orders[idx]),
      ),
    );
  }

  Widget _buildSavedTab(BuildContext context, List<ThriftItem> savedItems) {
    if (savedItems.isEmpty) {
      return const _Empty(icon: Icons.bookmark_border, text: 'Nothing saved yet. Tap the bookmark on a drop to save it.');
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
      children: [
        for (final item in savedItems)
          AppCard(
            margin: const EdgeInsets.only(bottom: 16),
            radius: 20,
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                ItemThumb(item: item, size: 52),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.title,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                      Text('${item.condition} · ${item.sellerName}',
                          style: TextStyle(fontSize: 11, color: DobhaColors.muted), maxLines: 1, overflow: TextOverflow.ellipsis),
                      Text(item.formattedPrice, style: TextStyle(fontWeight: FontWeight.w600, color: DobhaColors.green, fontSize: 13)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                item.isClaimed
                    ? AppTag('SOLD', color: DobhaColors.amber)
                    : AppButton(
                        color: DobhaColors.green,
                        radius: 12,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        onPressed: () => CheckoutModal.show(context, item),
                        child: const Text('Buy', style: TextStyle(fontSize: 13)),
                      ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback? onTap;

  const _Stat({required this.label, required this.value, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18, letterSpacing: -0.4)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  final IconData icon;
  final String text;

  const _Empty({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppWell(circle: true, padding: const EdgeInsets.all(18), child: Icon(icon, size: 34, color: DobhaColors.muted)),
            const SizedBox(height: 14),
            Text(text, textAlign: TextAlign.center, style: TextStyle(color: DobhaColors.muted)),
          ],
        ),
      ),
    );
  }
}

class _TabsDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;

  _TabsDelegate(this.tabBar);

  @override
  double get minExtent => tabBar.preferredSize.height + 1;
  @override
  double get maxExtent => minExtent;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      decoration: BoxDecoration(color: DobhaColors.bg, border: Border(bottom: BorderSide(color: DobhaColors.border))),
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_TabsDelegate oldDelegate) => true;
}
