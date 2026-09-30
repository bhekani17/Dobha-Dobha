import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../live_screen.dart';
import 'feed_screen.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/item_grid_tile.dart';
import '../widgets/ui.dart';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _selectedCategory = 'All';
  String _selectedLocation = 'All Joburg';
  String _searchQuery = '';

  List<LiveRoom> _liveRooms = const [];
  bool _roomsLoaded = false;
  Timer? _roomsTimer;

  final _categories = ['All', ...ThriftItem.categories];
  final _locations = ['All Joburg', 'Small Street', 'Braamfontein', 'Maboneng', 'Bree Street'];

  @override
  void initState() {
    super.initState();
    _loadRooms();
    _roomsTimer = Timer.periodic(const Duration(seconds: 10), (_) => _loadRooms());
  }

  @override
  void dispose() {
    _roomsTimer?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadRooms() async {
    try {
      final rooms = await AppState().api.rooms();
      if (mounted) setState(() => _liveRooms = rooms);
    } catch (_) {
      // Keep the last known list; the next poll retries.
    }
    if (mounted && !_roomsLoaded) setState(() => _roomsLoaded = true);
  }

  void _watchLive(String roomName) {
    final appState = AppState();
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LiveScreen(api: appState.api, roomName: roomName, identity: appState.user.name, host: false),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final allItems = AppState().feedItems;
        final q = _searchQuery.toLowerCase();

        final filtered = allItems.where((it) {
          final matchesCategory = _selectedCategory == 'All' || it.category == _selectedCategory;
          final matchesLocation =
              _selectedLocation == 'All Joburg' ||
              it.sellerLocation.toLowerCase().contains(_selectedLocation.toLowerCase());
          final matchesSearch =
              q.isEmpty ||
              it.title.toLowerCase().contains(q) ||
              it.description.toLowerCase().contains(q) ||
              it.category.toLowerCase().contains(q) ||
              it.sellerName.toLowerCase().contains(q);
          return matchesCategory && matchesLocation && matchesSearch;
        }).toList();

        return Scaffold(
          appBar: AppBar(
            toolbarHeight: 68,
            title: Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: 'Explore '),
                  TextSpan(
                    text: 'Joburg Drops',
                    style: TextStyle(color: DobhaColors.green),
                  ),
                ],
              ),
            ),
            actions: [
              AppButton.icon(
                icon: Icons.notifications_none_rounded,
                size: 20,
                padding: 10,
                onPressed: () {
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(const SnackBar(content: Text('No new drop notifications.')));
                },
              ),
              const SizedBox(width: 16),
            ],
          ),
          body: RefreshIndicator(
            color: DobhaColors.green,
            backgroundColor: DobhaColors.cardElevated,
            onRefresh: () => Future.wait([AppState().loadFeed(), _loadRooms()]),
            child: CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  sliver: SliverList.list(
                    children: [
                      TextField(
                        controller: _searchCtrl,
                        onChanged: (val) => setState(() => _searchQuery = val.trim()),
                        decoration: InputDecoration(
                          hintText: 'Search pieces, brands or sellers',
                          prefixIcon: Icon(Icons.search_rounded, color: DobhaColors.muted),
                          suffixIcon: _searchQuery.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.clear, size: 18),
                                  onPressed: () {
                                    _searchCtrl.clear();
                                    setState(() => _searchQuery = '');
                                  },
                                )
                              : null,
                        ),
                      ),
                      const SizedBox(height: 24),

                      Row(
                        children: [
                          Icon(Icons.sensors_rounded, color: DobhaColors.red, size: 18),
                          SizedBox(width: 6),
                          Text('Live Drops Now', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _buildLiveStreamsBar(),
                      const SizedBox(height: 24),

                      const Text('Item Type', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 10),
                      _chipRow(
                        _categories.map(
                          (cat) => AppChip(
                            label: cat,
                            selected: _selectedCategory == cat,
                            onTap: () => setState(() => _selectedCategory = cat),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      _chipRow(
                        _locations.map(
                          (loc) => AppChip(
                            label: loc,
                            icon: Icons.location_on_outlined,
                            accent: DobhaColors.cyan,
                            selected: _selectedLocation == loc,
                            onTap: () => setState(() => _selectedLocation = loc),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      Text(
                        '${filtered.length} Thrift Pieces Found',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: DobhaColors.muted),
                      ),
                      const SizedBox(height: 14),
                    ],
                  ),
                ),
                if (filtered.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Column(
                        children: [
                          Icon(Icons.search_off_rounded, size: 48, color: DobhaColors.muted),
                          SizedBox(height: 12),
                          Text('No items match your filter.', style: TextStyle(color: DobhaColors.muted)),
                        ],
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    sliver: SliverGrid.builder(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: 0.66,
                      ),
                      itemCount: filtered.length,
                      itemBuilder: (context, i) => ItemGridTile(
                        // Changing the search or filters gives tiles new keys, so they animate in again.
                        key: ValueKey('$_selectedCategory|$_selectedLocation|$_searchQuery|${filtered[i].id}'),
                        item: filtered[i],
                        index: i,
                        onTap: () => ItemDetailScreen.open(context, filtered[i]),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Horizontally scrolling row of chips.
  Widget _chipRow(Iterable<Widget> chips) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [for (final c in chips) Padding(padding: const EdgeInsets.only(right: 12), child: c)],
      ),
    );
  }

  Widget _buildLiveStreamsBar() {
    if (_liveRooms.isEmpty) {
      return AppWell(
        radius: 20,
        padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
        child: Row(
          children: [
            Icon(Icons.videocam_off_outlined, color: DobhaColors.muted),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                _roomsLoaded ? 'No one is live right now. Check back soon.' : 'Looking for live drops...',
                style: TextStyle(color: DobhaColors.muted, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );
    }

    return SizedBox(
      height: 124,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        padding: const EdgeInsets.symmetric(vertical: 4),
        itemCount: _liveRooms.length,
        separatorBuilder: (_, _) => const SizedBox(width: 16),
        itemBuilder: (context, idx) {
          final room = _liveRooms[idx];
          return SizedBox(
            width: 190,
            child: AppCard(
              radius: 20,
              padding: const EdgeInsets.all(14),
              onTap: () => _watchLive(room.name),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      AppTag('LIVE', color: DobhaColors.red, icon: Icons.circle, solid: true),
                      const Spacer(),
                      Icon(Icons.visibility, size: 13, color: DobhaColors.muted),
                      const SizedBox(width: 4),
                      Text('${room.viewers}', style: TextStyle(fontSize: 11, color: DobhaColors.muted)),
                    ],
                  ),
                  Text(
                    room.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                  ),
                  Text(
                    'Tap to watch',
                    style: TextStyle(color: DobhaColors.green, fontSize: 11, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
