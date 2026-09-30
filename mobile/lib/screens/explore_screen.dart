import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../live_screen.dart';
import 'feed_screen.dart';
import '../models/social.dart';
import '../widgets/user_avatar.dart';
import 'cart_screen.dart';
import 'notifications_screen.dart';
import 'seller_screen.dart';
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

  // Search runs on the server over every available piece; typing waits for a pause.
  Timer? _searchDebounce;
  bool _searching = false;
  String? _searchError;
  int _searchSeq = 0;
  List<PersonRow> _people = const [];

  final _categories = ['All', ...ThriftItem.categories];
  final _locations = ['All Joburg', 'Small Street', 'Braamfontein', 'Maboneng', 'Bree Street'];

  @override
  void initState() {
    super.initState();
    _loadRooms();
    _roomsTimer = Timer.periodic(const Duration(seconds: 10), (_) => _loadRooms());
    _search();
  }

  @override
  void dispose() {
    _roomsTimer?.cancel();
    _searchDebounce?.cancel();
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

  Future<void> _search() async {
    _searchDebounce?.cancel();
    final seq = ++_searchSeq;
    setState(() {
      _searching = true;
      _searchError = null;
    });
    try {
      final results = await Future.wait([
        AppState().search(
          query: _searchQuery,
          category: _selectedCategory == 'All' ? null : _selectedCategory,
          location: _selectedLocation == 'All Joburg' ? null : _selectedLocation,
        ),
        // People whose name or @handle matches, so shoppers can find each other to follow.
        AppState().searchPeople(_searchQuery),
      ]);
      if (mounted && seq == _searchSeq) _people = results[1] as List<PersonRow>;
    } on ApiException catch (e) {
      if (seq == _searchSeq) _searchError = e.message;
    }
    // Only the latest search clears the spinner; older ones may finish after it.
    if (mounted && seq == _searchSeq) setState(() => _searching = false);
  }

  void _onQueryChanged(String value) {
    setState(() => _searchQuery = value.trim());
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), _search);
  }

  Future<void> _pickArea() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: DobhaColors.surface,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text('Area', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            ),
            for (final loc in _locations)
              ListTile(
                title: Text(loc),
                trailing: loc == _selectedLocation ? Icon(Icons.check_rounded, color: DobhaColors.green) : null,
                onTap: () => Navigator.of(ctx).pop(loc),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (picked == null || picked == _selectedLocation) return;
    _selectedLocation = picked;
    _search();
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
        final filtered = AppState().searchResults;

        return Scaffold(
          appBar: AppBar(
            toolbarHeight: 68,
            title: const Text('Explore'),
            actions: [const CartButton(), const SizedBox(width: 12), const NotificationBell(), const SizedBox(width: 16)],
          ),
          body: RefreshIndicator(
            color: DobhaColors.green,
            backgroundColor: DobhaColors.cardElevated,
            onRefresh: () => Future.wait([_search(), _loadRooms()]),
            child: CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  sliver: SliverList.list(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _searchCtrl,
                              onChanged: _onQueryChanged,
                              textInputAction: TextInputAction.search,
                              onSubmitted: (_) => _search(),
                              decoration: InputDecoration(
                                hintText: 'Search pieces, brands or people',
                                prefixIcon: Icon(Icons.search_rounded, color: DobhaColors.muted),
                                suffixIcon: _searchQuery.isNotEmpty
                                    ? IconButton(
                                        icon: const Icon(Icons.clear, size: 18),
                                        onPressed: () {
                                          _searchCtrl.clear();
                                          _searchQuery = '';
                                          _search();
                                        },
                                      )
                                    : null,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Badge(
                            isLabelVisible: _selectedLocation != _locations.first,
                            smallSize: 9,
                            backgroundColor: DobhaColors.green,
                            child: AppButton.icon(
                              icon: Icons.tune_rounded,
                              size: 20,
                              padding: 12,
                              selected: _selectedLocation != _locations.first,
                              onPressed: _pickArea,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      _chipRow(
                        _categories.map(
                          (cat) => AppChip(
                            label: cat,
                            selected: _selectedCategory == cat,
                            onTap: () {
                              _selectedCategory = cat;
                              _search();
                            },
                          ),
                        ),
                      ),
                      if (_people.isNotEmpty && _searchQuery.length >= 2) ...[
                        const SizedBox(height: 18),
                        const Text('People', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 10),
                        SizedBox(
                          height: 96,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: _people.length,
                            separatorBuilder: (_, _) => const SizedBox(width: 14),
                            itemBuilder: (context, i) {
                              final p = _people[i];
                              return GestureDetector(
                                onTap: () => SellerScreen.open(context, p.id),
                                child: SizedBox(
                                  width: 72,
                                  child: Column(
                                    children: [
                                      UserAvatar(url: p.avatarUrl, name: p.name, size: 56),
                                      const SizedBox(height: 6),
                                      Text(p.name,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          textAlign: TextAlign.center,
                                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                                      Text(p.handle,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(fontSize: 10.5, color: DobhaColors.muted)),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                      // Live streams only take space when someone is live.
                      if (_liveRooms.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        Row(
                          children: [
                            Icon(Icons.circle, color: DobhaColors.red, size: 10),
                            const SizedBox(width: 8),
                            const Text('Live now', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _buildLiveStreamsBar(),
                      ],
                      const SizedBox(height: 18),

                      Row(
                        children: [
                          Text(
                            _searching
                                ? 'Searching...'
                                : '${filtered.length}${filtered.length == 50 ? '+' : ''} pieces'
                                      '${_selectedLocation == _locations.first ? '' : ' in $_selectedLocation'}',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: DobhaColors.muted),
                          ),
                          if (_searching) ...[
                            const SizedBox(width: 8),
                            SizedBox(
                              width: 12,
                              height: 12,
                              child: CircularProgressIndicator(strokeWidth: 2, color: DobhaColors.muted),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 14),
                    ],
                  ),
                ),
                if (filtered.isEmpty && !_searching)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Column(
                        children: [
                          Icon(
                            _searchError != null ? Icons.cloud_off_rounded : Icons.search_off_rounded,
                            size: 48,
                            color: DobhaColors.muted,
                          ),
                          SizedBox(height: 12),
                          Text(
                            _searchError ?? 'Nothing matches that. Try another word or category.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: DobhaColors.muted),
                          ),
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
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
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
