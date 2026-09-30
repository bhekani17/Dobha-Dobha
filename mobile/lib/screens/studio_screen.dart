import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../live_screen.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';

class StudioScreen extends StatefulWidget {
  const StudioScreen({super.key});

  @override
  State<StudioScreen> createState() => _StudioScreenState();
}

class _StudioScreenState extends State<StudioScreen> {
  final TextEditingController _streamTitleCtrl = TextEditingController(text: 'bale-1');
  ThriftItem? _selectedItemToPin;
  int _timerSeconds = 60;
  bool _isLaunching = false;

  // Simulator state for testing studio controls offline
  bool _mockLiveActive = false;
  final int _mockViewers = 48;
  Timer? _countdownTimer;
  int _remainingSeconds = 60;
  bool _itemClaimed = false;

  @override
  void initState() {
    super.initState();
    final inventory = AppState().vendorInventory;
    if (inventory.isNotEmpty) {
      _selectedItemToPin = inventory.first;
    }
  }

  @override
  void dispose() {
    _streamTitleCtrl.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startLiveKitStream() async {
    final streamName = _streamTitleCtrl.text.trim();
    if (streamName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a stream name (e.g. bale-1)')),
      );
      return;
    }

    setState(() => _isLaunching = true);
    final appState = AppState();

    try {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => LiveScreen(
            api: appState.api,
            roomName: streamName,
            identity: appState.user.name,
            host: true,
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('LiveKit stream note: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLaunching = false);
    }
  }

  void _startMockLiveSession() {
    HapticFeedback.heavyImpact();
    setState(() {
      _mockLiveActive = true;
      _remainingSeconds = _timerSeconds;
      _itemClaimed = false;
    });

    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_remainingSeconds > 0) {
        setState(() => _remainingSeconds--);
      } else {
        timer.cancel();
      }
    });
  }

  void _simulateRapidClaim() {
    HapticFeedback.vibrate();
    setState(() {
      _itemClaimed = true;
      _countdownTimer?.cancel();
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: DobhaColors.green,
        content: Text('⚡ RAPID CLAIM: Sipho_JHB locked this item into Escrow!'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final appState = AppState();
        final inventory = appState.vendorInventory;

        return Scaffold(
          appBar: AppBar(
            title: const Row(
              children: [
                Icon(Icons.video_camera_front_rounded, color: DobhaColors.green, size: 22),
                SizedBox(width: 8),
                Text('Vendor Live Studio'),
              ],
            ),
            actions: [
              // Switch role badge
              TextButton.icon(
                style: TextButton.styleFrom(
                  backgroundColor: appState.isVendor ? DobhaColors.green.withValues(alpha: 0.15) : DobhaColors.cardElevated,
                ),
                onPressed: () {
                  appState.toggleRole();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Switched to ${appState.isVendor ? "Vendor (Bale Boss) Mode 👑" : "Shopper Mode 🛍️"}'),
                    ),
                  );
                },
                icon: Icon(
                  appState.isVendor ? Icons.storefront_rounded : Icons.shopping_bag_outlined,
                  size: 16,
                  color: appState.isVendor ? DobhaColors.green : DobhaColors.muted,
                ),
                label: Text(
                  appState.isVendor ? 'Vendor Mode' : 'Shopper Mode',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: appState.isVendor ? DobhaColors.green : DobhaColors.muted,
                  ),
                ),
              ),
              const SizedBox(width: 12),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Studio Status Header
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      DobhaColors.card,
                      DobhaColors.green.withValues(alpha: 0.08),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: DobhaColors.green.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(
                        color: DobhaColors.green,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.podcasts_rounded, color: Colors.black, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            appState.user.vendorShopName,
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '📍 ${appState.user.vendorStallLocation}',
                            style: const TextStyle(fontSize: 12, color: DobhaColors.textSecondary),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Broadcast live video to shoppers across SA. Pin items with countdown timers for rapid claiming.',
                            style: TextStyle(fontSize: 11, color: DobhaColors.muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // If mock live session is active, show the Live Control Room
              if (_mockLiveActive) ...[
                _buildLiveControlRoom(),
                const SizedBox(height: 24),
              ],

              // Setup: Stream Name
              const Text('Stream Details', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 8),
              TextField(
                controller: _streamTitleCtrl,
                decoration: const InputDecoration(
                  labelText: 'Stream Channel ID',
                  hintText: 'e.g. bale-1 or downtown-grails',
                  prefixIcon: Icon(Icons.tag, size: 18),
                ),
              ),
              const SizedBox(height: 16),

              // Pick Item to Pin to Live
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Select Item to Pin', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  TextButton.icon(
                    onPressed: () => _showAddItemSheet(context),
                    icon: const Icon(Icons.add, size: 16, color: DobhaColors.green),
                    label: const Text('New Item', style: TextStyle(color: DobhaColors.green, fontSize: 12)),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              if (inventory.isEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: DobhaColors.card,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: DobhaColors.border),
                  ),
                  child: const Text('No inventory pieces listed yet. Tap "+ New Item" above.', style: TextStyle(color: DobhaColors.muted, fontSize: 13)),
                )
              else
                ...inventory.map((item) {
                  final isSelected = _selectedItemToPin?.id == item.id;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? DobhaColors.green.withValues(alpha: 0.1) : DobhaColors.card,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected ? DobhaColors.green : DobhaColors.border,
                        width: isSelected ? 1.5 : 1.0,
                      ),
                    ),
                    child: ListTile(
                      leading: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: DobhaColors.cardElevated,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.checkroom_rounded, color: DobhaColors.green, size: 24),
                      ),
                      title: Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      subtitle: Text('${item.condition} · Size: ${item.size}', style: const TextStyle(fontSize: 11, color: DobhaColors.muted)),
                      trailing: Text(item.formattedPrice, style: const TextStyle(fontWeight: FontWeight.w800, color: DobhaColors.green, fontSize: 14)),
                      onTap: () => setState(() => _selectedItemToPin = item),
                    ),
                  );
                }),
              const SizedBox(height: 16),

              // Countdown Timer Selector for Rapid Claiming
              const Text('Claiming Blitz Countdown', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 4),
              const Text('How long buyers have to rapid-claim before the next piece', style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
              const SizedBox(height: 8),
              Row(
                children: [30, 60, 90, 120].map((sec) {
                  final isSel = _timerSeconds == sec;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text('$sec sec'),
                      selected: isSel,
                      selectedColor: DobhaColors.cyan,
                      backgroundColor: DobhaColors.card,
                      labelStyle: TextStyle(
                        color: isSel ? Colors.black : DobhaColors.text,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                      onSelected: (val) {
                        if (val) setState(() => _timerSeconds = sec);
                      },
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),

              // Launch Buttons
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: DobhaColors.green,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: _isLaunching ? null : _startLiveKitStream,
                icon: const Icon(Icons.sensors_rounded, size: 20),
                label: const Text('GO LIVE NOW (LIVEKIT BROADCAST)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 0.5)),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _startMockLiveSession,
                icon: const Icon(Icons.play_circle_outline_rounded, size: 18),
                label: const Text('Test Studio & Pinning Simulator'),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLiveControlRoom() {
    final item = _selectedItemToPin;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF16161B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: DobhaColors.red, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: DobhaColors.red.withValues(alpha: 0.2),
            blurRadius: 15,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Bar
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: DobhaColors.red,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.circle, size: 8, color: Colors.white),
                    SizedBox(width: 4),
                    Text('STUDIO BROADCASTING', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white)),
                  ],
                ),
              ),
              Row(
                children: [
                  const Icon(Icons.people_alt_rounded, size: 16, color: DobhaColors.muted),
                  const SizedBox(width: 4),
                  Text('$_mockViewers Live Viewers', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Pinned Product Live Banner
          if (item != null)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: DobhaColors.cardElevated,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: DobhaColors.borderLight),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: DobhaColors.border,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.push_pin_rounded, color: DobhaColors.green, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13), maxLines: 1),
                        Text('${item.formattedPrice} · ${item.condition}', style: const TextStyle(color: DobhaColors.green, fontSize: 12, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                  // Countdown Timer Pill
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: _remainingSeconds <= 10 ? DobhaColors.red.withValues(alpha: 0.2) : DobhaColors.cyan.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: _remainingSeconds <= 10 ? DobhaColors.red : DobhaColors.cyan),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.timer_outlined, size: 14, color: DobhaColors.cyan),
                        const SizedBox(width: 4),
                        Text(
                          '${_remainingSeconds}s',
                          style: const TextStyle(fontWeight: FontWeight.w900, color: DobhaColors.cyan, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 14),

          // Moderator Controls
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: _itemClaimed ? Colors.amber : DobhaColors.green,
                    foregroundColor: Colors.black,
                  ),
                  onPressed: _itemClaimed ? null : _simulateRapidClaim,
                  icon: const Icon(Icons.flash_on, size: 16),
                  label: Text(_itemClaimed ? 'SOLD OUT 🎉' : 'Simulate Buyer Claim'),
                ),
              ),
              const SizedBox(width: 10),
              IconButton.outlined(
                onPressed: () {
                  _countdownTimer?.cancel();
                  setState(() => _mockLiveActive = false);
                },
                icon: const Icon(Icons.stop_circle_outlined, color: DobhaColors.red),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showAddItemSheet(BuildContext context) {
    final titleCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    String condition = 'Grade A Vintage';
    String size = 'L';
    String category = 'Jackets';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: DobhaColors.card,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Add Thrift Piece to Inventory', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(labelText: 'Item Name / Description (e.g. 90s Carhartt Vest)'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: priceCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Price (ZAR)', prefixText: 'R '),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: size,
                      decoration: const InputDecoration(labelText: 'Size'),
                      dropdownColor: DobhaColors.card,
                      items: ['S', 'M', 'L', 'XL', '2XL', 'Free Size'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                      onChanged: (val) {
                        if (val != null) setSheetState(() => size = val);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: condition,
                decoration: const InputDecoration(labelText: 'Vintage Condition'),
                dropdownColor: DobhaColors.card,
                items: ['Grade A Vintage', '90s Deadstock', 'Lightly Worn', 'Distressed Classic'].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                onChanged: (val) {
                  if (val != null) setSheetState(() => condition = val);
                },
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () {
                  final title = titleCtrl.text.trim();
                  final price = double.tryParse(priceCtrl.text.trim()) ?? 0.0;
                  if (title.isEmpty || price <= 0) return;

                  final newItem = ThriftItem(
                    id: 'item-${DateTime.now().millisecondsSinceEpoch}',
                    title: title,
                    priceZar: price,
                    condition: condition,
                    size: size,
                    category: category,
                    sellerId: AppState().user.id,
                    sellerName: AppState().user.vendorShopName,
                    sellerHandle: AppState().user.handle,
                    sellerLocation: AppState().user.vendorStallLocation,
                    sellerBadge: AppState().user.vendorBadge,
                    description: 'Handpicked downtown Joburg piece.',
                  );

                  AppState().addInventoryItem(newItem);
                  setState(() => _selectedItemToPin = newItem);
                  Navigator.of(ctx).pop();
                },
                child: const Text('Add to Shop & Studio'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
