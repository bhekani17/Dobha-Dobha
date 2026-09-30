import 'package:flutter/material.dart';

import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/checkout_modal.dart';
import '../widgets/escrow_tracker_badge.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showRoleToggleSheet(BuildContext context) {
    final appState = AppState();
    final isVendor = appState.isVendor;

    showModalBottomSheet(
      context: context,
      backgroundColor: DobhaColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(isVendor ? Icons.shopping_bag_outlined : Icons.storefront_rounded, color: DobhaColors.green, size: 24),
                const SizedBox(width: 10),
                Text(
                  isVendor ? 'Switch to Shopper Mode' : 'Become a Downtown Vendor',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              isVendor
                  ? 'Switch back to Shopper mode to browse reels, claim thrift pieces, and track incoming deliveries.'
                  : 'Start selling from your downtown Joburg bale, go live with camera pinning, and get paid through secure in-app escrow.',
              style: const TextStyle(fontSize: 13, color: DobhaColors.textSecondary, height: 1.3),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: () {
                appState.toggleRole();
                Navigator.of(ctx).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    backgroundColor: DobhaColors.green,
                    content: Text('Switched to ${appState.isVendor ? "Vendor Mode 👑" : "Shopper Mode 🛍️"}'),
                  ),
                );
              },
              icon: const Icon(Icons.swap_horiz_rounded),
              label: Text(isVendor ? 'Switch to Shopper (Thrifter)' : 'Activate Bale Boss Mode'),
            ),
          ],
        ),
      ),
    );
  }

  void _showServerSettings(BuildContext context) {
    final appState = AppState();
    final ctrl = TextEditingController(text: appState.serverUrl);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: DobhaColors.card,
        title: const Text('LiveKit Server URL'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(hintText: 'http://192.168.1.19:3000'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              appState.setServerUrl(ctrl.text.trim());
              Navigator.of(ctx).pop();
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final appState = AppState();
        final user = appState.user;
        final orders = appState.orders;
        final inventory = appState.vendorInventory;
        final savedItems = appState.feedItems.where((i) => appState.savedItemIds.contains(i.id)).toList();

        return Scaffold(
          appBar: AppBar(
            title: const Text('Account & Orders'),
            actions: [
              IconButton(
                icon: const Icon(Icons.settings_outlined),
                onPressed: () => _showServerSettings(context),
              ),
            ],
          ),
          body: NestedScrollView(
            headerSliverBuilder: (context, _) => [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    children: [
                      // Profile Header
                      Row(
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: DobhaColors.cardElevated,
                              border: Border.all(color: DobhaColors.green, width: 2),
                            ),
                            child: Center(
                              child: Text(
                                user.avatarInitials,
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: DobhaColors.green),
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        user.name,
                                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    const Icon(Icons.verified, size: 16, color: DobhaColors.cyan),
                                  ],
                                ),
                                Text(user.handle, style: const TextStyle(fontSize: 12, color: DobhaColors.muted)),
                                const SizedBox(height: 2),
                                Text(user.phone, style: const TextStyle(fontSize: 11, color: DobhaColors.textSecondary)),
                              ],
                            ),
                          ),
                          // Role Switcher Button
                          FilledButton.tonal(
                            style: FilledButton.styleFrom(
                              backgroundColor: appState.isVendor ? DobhaColors.gold.withValues(alpha: 0.2) : DobhaColors.green.withValues(alpha: 0.15),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            ),
                            onPressed: () => _showRoleToggleSheet(context),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(appState.isVendor ? Icons.store : Icons.shopping_bag, size: 16, color: appState.isVendor ? DobhaColors.gold : DobhaColors.green),
                                const SizedBox(width: 6),
                                Text(
                                  appState.isVendor ? 'Vendor' : 'Shopper',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 12,
                                    color: appState.isVendor ? DobhaColors.gold : DobhaColors.green,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Trust & Reputation Banner
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: DobhaColors.card,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: DobhaColors.border),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            _buildStat('Rating', '⭐ ${user.rating}'),
                            _buildDivider(),
                            _buildStat('Dobhas', '${user.totalSalesCount}'),
                            _buildDivider(),
                            _buildStat('Escrow Vault', '100% Protected', color: DobhaColors.cyan),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ),

              // Sticky Tabs
              SliverPersistentHeader(
                pinned: true,
                delegate: _SliverAppBarDelegate(
                  TabBar(
                    controller: _tabController,
                    indicatorColor: DobhaColors.green,
                    indicatorWeight: 3,
                    labelColor: DobhaColors.green,
                    unselectedLabelColor: DobhaColors.muted,
                    labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                    tabs: [
                      Tab(text: 'Orders (${orders.length})'),
                      Tab(text: appState.isVendor ? 'Inventory (${inventory.length})' : 'Vendor Shop'),
                      Tab(text: 'Saved (${savedItems.length})'),
                    ],
                  ),
                ),
              ),
            ],
            body: TabBarView(
              controller: _tabController,
              children: [
                // Orders Tab with Escrow Steppers
                _buildOrdersTab(orders, appState.isVendor),

                // Inventory / Vendor Tab
                _buildInventoryTab(context, inventory, appState.isVendor),

                // Saved Drops Tab
                _buildSavedTab(context, savedItems),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStat(String label, String value, {Color? color}) {
    return Column(
      children: [
        Text(value, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: color ?? DobhaColors.text)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 10, color: DobhaColors.muted)),
      ],
    );
  }

  Widget _buildDivider() {
    return Container(height: 24, width: 1, color: DobhaColors.border);
  }

  Widget _buildOrdersTab(List orders, bool isVendor) {
    if (orders.isEmpty) {
      return const Center(child: Text('No orders yet. Tap "Claim" on the feed to test!'));
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: orders.length,
      itemBuilder: (context, idx) {
        return EscrowTrackerCard(order: orders[idx], isVendorView: isVendor);
      },
    );
  }

  Widget _buildInventoryTab(BuildContext context, List<ThriftItem> inventory, bool isVendor) {
    if (!isVendor) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.storefront_outlined, size: 54, color: DobhaColors.muted),
              const SizedBox(height: 12),
              const Text('Want to sell vintage pieces?', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              const Text(
                'Switch to Vendor Mode to manage inventory, go live from your Joburg stall, and receive payouts via in-app escrow.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: DobhaColors.textSecondary),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => _showRoleToggleSheet(context),
                child: const Text('Switch to Vendor Mode'),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Your Listed Thrift Pieces', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            Text('${inventory.length} pieces', style: const TextStyle(color: DobhaColors.muted, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 12),
        ...inventory.map((item) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: DobhaColors.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: DobhaColors.border),
              ),
              child: Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: DobhaColors.cardElevated,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.checkroom_rounded, color: DobhaColors.green),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13), maxLines: 1),
                        Text('${item.condition} · Size: ${item.size}', style: const TextStyle(fontSize: 11, color: DobhaColors.muted)),
                        Text(item.formattedPrice, style: const TextStyle(fontWeight: FontWeight.w800, color: DobhaColors.green, fontSize: 13)),
                      ],
                    ),
                  ),
                  FilledButton.tonal(
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      minimumSize: Size.zero,
                    ),
                    onPressed: () {
                      AppState().pinItemToLive(item);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Pinned "${item.title}" to Live Studio!')),
                      );
                    },
                    child: const Text('Pin to Live', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            )),
      ],
    );
  }

  Widget _buildSavedTab(BuildContext context, List<ThriftItem> savedItems) {
    if (savedItems.isEmpty) {
      return const Center(child: Text('No saved items yet. Tap bookmark on drops to save!'));
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: savedItems.length,
      itemBuilder: (context, idx) {
        final item = savedItems[idx];
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: DobhaColors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: DobhaColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: DobhaColors.cardElevated,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.checkroom_rounded, color: DobhaColors.green),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13), maxLines: 1),
                    Text('${item.condition} · ${item.sellerName}', style: const TextStyle(fontSize: 11, color: DobhaColors.muted)),
                    Text(item.formattedPrice, style: const TextStyle(fontWeight: FontWeight.w800, color: DobhaColors.green, fontSize: 13)),
                  ],
                ),
              ),
              FilledButton(
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  minimumSize: Size.zero,
                ),
                onPressed: () => CheckoutModal.show(context, item),
                child: const Text('DOBHA', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SliverAppBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;

  _SliverAppBarDelegate(this.tabBar);

  @override
  double get minExtent => tabBar.preferredSize.height;
  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: DobhaColors.bg,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_SliverAppBarDelegate oldDelegate) => false;
}
