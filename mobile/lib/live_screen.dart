import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:livekit_client/livekit_client.dart';

import 'api.dart';
import 'live_models.dart';
import 'theme.dart';
import 'widgets/floating_reactions.dart';
import 'widgets/pinned_product_card.dart';

/// One live stream. Hosts publish camera + mic; viewers watch. Everyone can chat & react.
class LiveScreen extends StatefulWidget {
  final Api api;
  final String roomName;
  final String identity;
  final bool host;

  const LiveScreen({
    super.key,
    required this.api,
    required this.roomName,
    required this.identity,
    required this.host,
  });

  @override
  State<LiveScreen> createState() => _LiveScreenState();
}

class _ChatMessage {
  final String who;
  final String text;
  final bool isSystem;
  _ChatMessage(this.who, this.text, {this.isSystem = false});
}

class _LiveScreenState extends State<LiveScreen> {
  final _room = Room(
    roomOptions: const RoomOptions(
      adaptiveStream: true,
      dynacast: true,
      defaultAudioOutputOptions: AudioOutputOptions(speakerOn: true),
    ),
  );
  late final EventsListener<RoomEvent> _listener = _room.createListener();
  final _messages = <_ChatMessage>[];
  final _chatController = TextEditingController();
  final _chatScroll = ScrollController();
  final _reactions = FloatingReactionsController();

  PinnedItem? _pinnedItem;
  CameraPosition _cameraPosition = CameraPosition.front;

  bool _connecting = true;
  bool _leaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _room.addListener(_refresh);
    _listener
      ..on<DataReceivedEvent>(_onData)
      ..on<ParticipantConnectedEvent>(_onParticipantConnected)
      ..on<RoomDisconnectedEvent>((_) {
        if (!_leaving && mounted) Navigator.of(context).pop();
      });
    _join();
  }

  Future<void> _join() async {
    try {
      final info = await widget.api.token(room: widget.roomName, identity: widget.identity, host: widget.host);
      await _room.connect(info.url, info.token);
      if (widget.host) {
        await _room.localParticipant?.setCameraEnabled(true);
        await _room.localParticipant?.setMicrophoneEnabled(true);
      }
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }
    if (mounted) setState(() => _connecting = false);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  void _onParticipantConnected(ParticipantConnectedEvent e) {
    _refresh();
    // If we are host and an item is currently pinned, broadcast it so the new viewer sees it immediately.
    if (widget.host && _pinnedItem != null) {
      _sendData({'type': 'pin_item', 'item': _pinnedItem!.toJson()});
    }
  }

  void _onData(DataReceivedEvent e) {
    try {
      final msg = jsonDecode(utf8.decode(e.data)) as Map<String, dynamic>;
      final type = msg['type'];

      if (type == 'chat') {
        _addMessage(e.participant?.name ?? 'someone', msg['text'] as String);
      } else if (type == 'reaction') {
        _reactions.addReaction(msg['emoji'] as String? ?? '❤️');
      } else if (type == 'pin_item') {
        final item = PinnedItem.fromJson(msg['item'] as Map<String, dynamic>);
        setState(() => _pinnedItem = item);
      } else if (type == 'unpin_item') {
        setState(() => _pinnedItem = null);
      } else if (type == 'claim_item') {
        final who = msg['who'] as String;
        final title = msg['title'] as String? ?? 'this item';
        final itemId = msg['itemId'] as String?;
        if (_pinnedItem != null && _pinnedItem!.id == itemId) {
          setState(() {
            _pinnedItem = _pinnedItem!.copyWith(status: 'sold', claimedBy: who);
          });
        }
        _addMessage('🎉', '$who claimed $title!', isSystem: true);
        _reactions.addReaction('🎉');
        _reactions.addReaction('🔥');
      }
    } catch (_) {
      // Ignore unknown payloads
    }
  }

  void _addMessage(String who, String text, {bool isSystem = false}) {
    setState(() => _messages.add(_ChatMessage(who, text, isSystem: isSystem)));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_chatScroll.hasClients) _chatScroll.jumpTo(_chatScroll.position.maxScrollExtent);
    });
  }

  Future<void> _sendData(Map<String, dynamic> payload) async {
    final local = _room.localParticipant;
    if (local == null) return;
    try {
      await local.publishData(utf8.encode(jsonEncode(payload)), reliable: true);
    } catch (_) {}
  }

  Future<void> _sendChat() async {
    final text = _chatController.text.trim();
    final local = _room.localParticipant;
    if (text.isEmpty || local == null) return;
    try {
      await local.publishData(utf8.encode(jsonEncode({'type': 'chat', 'text': text})), reliable: true);
    } catch (_) {
      _addMessage('', 'Message not sent, check your connection');
      return;
    }
    _addMessage(local.name, text);
    _chatController.clear();
  }

  void _sendReaction([String emoji = '❤️']) {
    HapticFeedback.lightImpact();
    _reactions.addReaction(emoji);
    _sendData({'type': 'reaction', 'emoji': emoji});
  }

  Future<void> _flipCamera() async {
    final track = _room.localParticipant?.videoTrackPublications.firstOrNull?.track;
    if (track == null) return;
    try {
      final next = _cameraPosition.switched();
      await track.setCameraPosition(next);
      if (mounted) setState(() => _cameraPosition = next);
    } catch (e) {
      debugPrint('Camera flip failed: $e');
    }
  }

  Future<void> _openPinDialog() async {
    final item = await showPinItemModal(context: context, currentItem: _pinnedItem);
    if (item != null) {
      setState(() => _pinnedItem = item);
      await _sendData({'type': 'pin_item', 'item': item.toJson()});
      _addMessage('📢', 'Seller pinned: ${item.title} (${item.price})', isSystem: true);
    }
  }

  Future<void> _markItemSold() async {
    if (_pinnedItem == null) return;
    final updated = _pinnedItem!.copyWith(status: 'sold');
    setState(() => _pinnedItem = updated);
    await _sendData({'type': 'pin_item', 'item': updated.toJson()});
  }

  Future<void> _unpinItem() async {
    setState(() => _pinnedItem = null);
    await _sendData({'type': 'unpin_item'});
  }

  Future<void> _claimItem() async {
    if (_pinnedItem == null || _pinnedItem!.isSold) return;
    final current = _pinnedItem!;
    final updated = current.copyWith(status: 'sold', claimedBy: widget.identity);
    setState(() => _pinnedItem = updated);

    await _sendData({
      'type': 'claim_item',
      'itemId': current.id,
      'who': widget.identity,
      'title': current.title,
    });
    _addMessage('🎉', '${widget.identity} claimed ${current.title}!', isSystem: true);
    _reactions.addReaction('🎉');
    _reactions.addReaction('🔥');
  }

  Future<void> _leave() async {
    if (widget.host) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: DobhaColors.card,
          title: const Text('End Live Stream?'),
          content: const Text('Are you sure you want to stop broadcasting to all viewers?'),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: DobhaColors.red),
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('End Stream'),
            ),
          ],
        ),
      );
      if (confirm != true) return;
    }
    _leaving = true;
    await _room.disconnect();
    if (mounted) Navigator.of(context).pop();
  }

  VideoTrack? get _videoTrack {
    if (widget.host) {
      return _room.localParticipant?.videoTrackPublications.firstOrNull?.track;
    }
    for (final p in _room.remoteParticipants.values) {
      for (final pub in p.videoTrackPublications) {
        if (pub.subscribed && pub.track != null) return pub.track;
      }
    }
    return null;
  }

  @override
  void dispose() {
    _leaving = true;
    _room.removeListener(_refresh);
    _listener.dispose();
    _room.disconnect();
    _room.dispose();
    _chatController.dispose();
    _chatScroll.dispose();
    _reactions.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: _error != null
            ? _ErrorView(message: _error!, onBack: () => Navigator.of(context).pop())
            : Column(
                children: [
                  _topBar(),
                  Expanded(
                    flex: 3,
                    child: Stack(
                      children: [
                        Positioned.fill(child: _videoArea()),
                        Positioned.fill(child: FloatingReactionsLayer(controller: _reactions)),
                      ],
                    ),
                  ),
                  PinnedProductBanner(
                    item: _pinnedItem,
                    isHost: widget.host,
                    onPinTap: _openPinDialog,
                    onClaimTap: _claimItem,
                    onMarkSoldTap: _markItemSold,
                    onUnpinTap: _unpinItem,
                  ),
                  if (widget.host) _hostControls(),
                  Expanded(flex: 2, child: _chat()),
                ],
              ),
      ),
    );
  }

  Widget _topBar() {
    final people = _room.remoteParticipants.length + 1;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: DobhaColors.red, borderRadius: BorderRadius.circular(4)),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.fiber_manual_record, color: Colors.white, size: 10),
                SizedBox(width: 4),
                Text('LIVE', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text(widget.roomName,
                overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          ),
          const SizedBox(width: 10),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.remove_red_eye_outlined, size: 14, color: DobhaColors.muted),
              const SizedBox(width: 4),
              Text(people == 1 ? '1' : '$people', style: const TextStyle(color: DobhaColors.muted, fontSize: 13)),
            ],
          ),
          const Spacer(),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: DobhaColors.red.withValues(alpha: 0.85),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            ),
            onPressed: _leave,
            child: Text(widget.host ? 'End' : 'Leave'),
          ),
        ],
      ),
    );
  }

  Widget _videoArea() {
    final track = _videoTrack;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: DobhaColors.card, borderRadius: BorderRadius.circular(12)),
      child: track != null
          ? VideoTrackRenderer(track, fit: VideoViewFit.cover)
          : Center(
              child: Text(
                _connecting ? 'Connecting...' : (widget.host ? 'Starting camera...' : 'Waiting for host...'),
                style: const TextStyle(color: DobhaColors.muted),
              ),
            ),
    );
  }

  Widget _hostControls() {
    final local = _room.localParticipant;
    final camOn = local?.isCameraEnabled() ?? false;
    final micOn = local?.isMicrophoneEnabled() ?? false;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 8),
                side: BorderSide(color: camOn ? DobhaColors.border : DobhaColors.red),
              ),
              onPressed: local == null ? null : () => local.setCameraEnabled(!camOn),
              icon: Icon(camOn ? Icons.videocam : Icons.videocam_off, size: 18),
              label: Text(camOn ? 'Cam' : 'Off'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 8),
                side: BorderSide(color: micOn ? DobhaColors.border : DobhaColors.red),
              ),
              onPressed: local == null ? null : () => local.setMicrophoneEnabled(!micOn),
              icon: Icon(micOn ? Icons.mic : Icons.mic_off, size: 18),
              label: Text(micOn ? 'Mic' : 'Mute'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 8),
                foregroundColor: DobhaColors.green,
                side: const BorderSide(color: DobhaColors.border),
              ),
              onPressed: local == null ? null : _flipCamera,
              icon: const Icon(Icons.flip_camera_ios, size: 18),
              label: const Text('Flip'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _chat() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: DobhaColors.card, borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _chatScroll,
              itemCount: _messages.length,
              itemBuilder: (_, i) {
                final m = _messages[i];
                if (m.isSystem) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: DobhaColors.green.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${m.who} ${m.text}',
                        style: const TextStyle(color: DobhaColors.green, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                  );
                }
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text.rich(TextSpan(children: [
                    TextSpan(
                      text: '${m.who}: ',
                      style: const TextStyle(color: DobhaColors.green, fontWeight: FontWeight.w700),
                    ),
                    TextSpan(text: m.text),
                  ])),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _chatController,
                  decoration: const InputDecoration(hintText: 'Say something...'),
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _sendChat(),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 14)),
                onPressed: _connecting ? null : _sendChat,
                child: const Icon(Icons.send_rounded, size: 18),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: () => _sendReaction('❤️'),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                  ),
                  child: const Text('❤️', style: TextStyle(fontSize: 18)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onBack;
  const _ErrorView({required this.message, required this.onBack});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: DobhaColors.red)),
            const SizedBox(height: 16),
            FilledButton(onPressed: onBack, child: const Text('Back')),
          ],
        ),
      ),
    );
  }
}
