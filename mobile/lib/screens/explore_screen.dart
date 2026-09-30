import 'package:flutter/material.dart';

import '../live_screen.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/checkout_modal.dart';

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

  final _categories = ['All', 'Jackets', 'Denim', 'Sneakers', 'Workwear', 'Vintage Tees', 'Knitwear'];
  final _locations = ['All Joburg', 'Small Street', 'Braamfontein', 'Maboneng', 'Bree Street'];

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _watchLive(String roomName) {
    final appState = AppState();
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LiveScreen(
          api: appState.api,
          roomName: roomName,
          identity: appState.user.name,
          host: false,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final allItems = AppState().feedItems;

        final filtered = allItems.where((it) {
          final matchesCategory = _selectedCategory == 'All' || it.category == _selectedCategory;
          final matchesLocation = _selectedLocation == 'All Joburg' ||
              it.sellerLocation.toLowerCase().contains(_selectedLocation.toLowerCase());
          final matchesSearch = _searchQuery.isEmpty ||
              it.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
              it.description.toLowerCase().contains(_searchQuery.toLowerCase()) ||
              it.tags.any((t) => t.toLowerCase().contains(_searchQuery.toLowerCase()));
          return matchesCategory && matchesLocation && matchesSearch;
        }).toList();

        return Scaffold(
          appBar: AppBar(
            title: const Text.rich(
              TextSpan(children: [
                TextSpan(text: 'Explore '),
                TextSpan(text: 'Joburg Drops', style: TextStyle(color: DobhaColors.green)),
              ]),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.notifications_none_rounded),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('No new drop notifications.')),
                  );
                },
              ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            children: [
              // Search Input
              TextField(
                controller: _searchCtrl,
                onChanged: (val) => setState(() => _searchQuery = val.trim()),
                decoration: InputDecoration(
                  hintText: 'Search Carhartt, Levi\'s 501, Nike, Small Street...',
                  prefixIcon: const Icon(Icons.search_rounded, color: DobhaColors.muted),
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
              const SizedBox(height: 18),

              // Active Live Streams Highlight
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.sensors_rounded, color: DobhaColors.red, size: 18),
                      SizedBox(width: 6),
                      Text('Live Drops Now', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                    ],
                  ),
                  TextButton(
                    onPressed: () => _watchLive('bale-1'),
                    child: const Text('View All Live', style: TextStyle(color: DobhaColors.green, fontSize: 12)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              _buildLiveStreamsBar(),
              const SizedBox(height: 20),

              // Category Chips
              const Text('Filter by Item Type', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: _categories.map((cat) {
                    final isSel = _selectedCategory == cat;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(cat),
                        selected: isSel,
                        selectedColor: DobhaColors.green,
                        backgroundColor: DobhaColors.card,
                        labelStyle: TextStyle(
                          color: isSel ? Colors.black : DobhaColors.text,
                          fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                          fontSize: 12,
                        ),
                        side: BorderSide(color: isSel ? DobhaColors.green : DobhaColors.border),
                        onSelected: (val) {
                          if (val) setState(() => _selectedCategory = cat);
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 12),

              // Location / Market Vibe Chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: _locations.map((loc) {
                    final isSel = _selectedLocation == loc;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        avatar: Icon(Icons.location_on_outlined, size: 14, color: isSel ? Colors.black : DobhaColors.cyan),
                        label: Text(loc),
                        selected: isSel,
                        selectedColor: DobhaColors.cyan,
                        backgroundColor: DobhaColors.card,
                        labelStyle: TextStyle(
                          color: isSel ? Colors.black : DobhaColors.textSecondary,
                          fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                          fontSize: 11,
                        ),
                        side: BorderSide(color: isSel ? DobhaColors.cyan : DobhaColors.border),
                        onSelected: (val) {
                          setState(() => _selectedLocation = loc);
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 20),

              // Results Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('${filtered.length} Thrift Pieces Found', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: DobhaColors.muted)),
                  const Row(
                    children: [
                      Icon(Icons.tune_rounded, size: 16, color: DobhaColors.muted),
                      SizedBox(width: 4),
                      Text('Sort: Freshest Bales', style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Item Grid
              if (filtered.isEmpty)
                Container(
                  padding: const EdgeInsets.all(32),
                  alignment: Alignment.center,
                  child: const Column(
                    children: [
                      Icon(Icons.search_off_rounded, size: 48, color: DobhaColors.muted),
                      SizedBox(height: 12),
                      Text('No items match your filter.', style: TextStyle(color: DobhaColors.muted)),
                    ],
                  ),
                )
              else
                ...filtered.map((item) => _buildItemTile(context, item)),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLiveStreamsBar() {
    final mockRooms = [
      {'room': 'bale-1', 'title': 'Fresh Grade-A Carhartt Bale 📦', 'seller': 'Braam Bale Vault', 'viewers': 18},
      {'room': 'sneaker-drop', 'title': 'Downtown Dunks & AF1s 👟', 'seller': 'Kasi Kicks CBD', 'viewers': 42},
      {'room': 'denim-haul', 'title': '90s 501 Raw Selvedge Drop 🔥', 'seller': 'Small St Vintage', 'viewers': 29},
    ];

    return SizedBox(
      height: 110,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: mockRooms.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, idx) {
          final room = mockRooms[idx];
          return GestureDetector(
            onTap: () => _watchLive(room['room'] as String),
            child: Container(
              width: 190,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: DobhaColors.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: DobhaColors.red.withValues(alpha: 0.5)),
                gradient: LinearGradient(
                  colors: [
                    DobhaColors.card,
                    DobhaColors.red.withValues(alpha: 0.1),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: DobhaColors.red,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.circle, size: 6, color: Colors.white),
                            SizedBox(width: 4),
                            Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                          ],
                        ),
                      ),
                      const Spacer(),
                      Row(
                        children: [
                          const Icon(Icons.visibility, size: 12, color: DobhaColors.muted),
                          const SizedBox(width: 3),
                          Text('${room['viewers']}', style: const TextStyle(fontSize: 11, color: DobhaColors.muted)),
                        ],
                      ),
                    ],
                  ),
                  Text(
                    room['title'] as String,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                  ),
                  Text(
                    room['seller'] as String,
                    style: const TextStyle(color: DobhaColors.green, fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildItemTile(BuildContext context, ThriftItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: DobhaColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: DobhaColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Thumbnail
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: DobhaColors.cardElevated,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: DobhaColors.borderLight),
            ),
            child: const Center(
              child: Icon(Icons.checkroom_rounded, color: DobhaColors.green, size: 36),
            ),
          ),
          const SizedBox(width: 14),

          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: DobhaColors.gold.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        item.condition,
                        style: const TextStyle(color: DobhaColors.gold, fontSize: 10, fontWeight: FontWeight.w700),
                      ),
                    ),
                    Text(
                      'Size: ${item.size}',
                      style: const TextStyle(color: DobhaColors.muted, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  item.title,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '${item.sellerName} · ${item.sellerLocation}',
                  style: const TextStyle(color: DobhaColors.muted, fontSize: 11),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      item.formattedPrice,
                      style: const TextStyle(fontWeight: FontWeight.w900, color: DobhaColors.green, fontSize: 16),
                    ),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      onPressed: () => CheckoutModal.show(context, item),
                      child: const Text('DOBHA', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
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
}
