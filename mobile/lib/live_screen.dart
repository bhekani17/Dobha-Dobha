import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:livekit_client/livekit_client.dart';

import 'api.dart';
import 'live_models.dart';
import 'models/thrift_item.dart';
import 'theme.dart';
import 'widgets/checkout_modal.dart';
import 'widgets/floating_reactions.dart';
import 'widgets/ui.dart';
import 'widgets/pinned_product_card.dart';

/// One live stream. Hosts publish camera + mic; viewers watch. Everyone can chat & react.
class LiveScreen extends StatefulWidget {
  final Api api;
  final String roomName;
  final String identity;
  final bool host;

  /// Item a host picked in the studio; pinned as soon as the stream starts.
  final PinnedItem? initialPin;

  const LiveScreen({
    super.key,
    required this.api,
    required this.roomName,
    required this.identity,
    required this.host,
    this.initialPin,
  });

  @override
  State<LiveScreen> createState() => _LiveScreenState();
}

class _ChatMessage {
  final String who;
  final String text;
  final bool isSystem;
  final IconData? icon;
  _ChatMessage(this.who, this.text, {this.isSystem = false, this.icon});
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
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
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
      final info = await widget.api.liveToken(room: widget.roomName, host: widget.host);
      await _room.connect(info.url, info.token);
      if (widget.host) {
        await _room.localParticipant?.setCameraEnabled(true);
        await _room.localParticipant?.setMicrophoneEnabled(true);
        final pin = widget.initialPin;
        if (pin != null) {
          _pinnedItem = pin;
          await _sendData({'type': 'pin_item', 'item': pin.toJson()});
        }
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
        _reactions.addReaction(Reaction.fromName(msg['kind'] as String?));
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
        _addMessage('', '$who claimed $title!', isSystem: true, icon: Icons.celebration_rounded);
        _reactions.addReaction(Reaction.celebrate);
        _reactions.addReaction(Reaction.fire);
      }
    } catch (_) {
      // Ignore unknown payloads
    }
  }

  void _addMessage(String who, String text, {bool isSystem = false, IconData? icon}) {
    setState(() => _messages.add(_ChatMessage(who, text, isSystem: isSystem, icon: icon)));
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

  void _sendReaction([Reaction reaction = Reaction.heart]) {
    HapticFeedback.lightImpact();
    _reactions.addReaction(reaction);
    _sendData({'type': 'reaction', 'kind': reaction.name});
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
    final item = await showPinItemModal(context: context, currentId: _pinnedItem?.id);
    if (item != null) {
      setState(() => _pinnedItem = item);
      await _sendData({'type': 'pin_item', 'item': item.toJson()});
      _addMessage('', 'Seller pinned: ${item.title} (${item.price})', isSystem: true, icon: Icons.push_pin_rounded);
    }
  }

  Future<void> _unpinItem() async {
    setState(() => _pinnedItem = null);
    await _sendData({'type': 'unpin_item'});
  }

  /// Viewer claim: a real escrow checkout for the pinned listing, then tell the room.
  Future<void> _claimItem() async {
    if (_pinnedItem == null || _pinnedItem!.isSold) return;
    final current = _pinnedItem!;

    final ThriftItem item;
    try {
      final res = await widget.api.get('/api/items/${current.id}');
      item = ThriftItem.fromJson(res['item'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      return;
    }
    if (!mounted) return;
    if (item.isClaimed) {
      setState(() => _pinnedItem = current.copyWith(status: 'sold'));
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Someone already claimed this piece')));
      return;
    }
    final paid = await CheckoutModal.show(context, item);
    if (paid != true || !mounted) return;

    final updated = current.copyWith(status: 'sold', claimedBy: widget.identity);
    setState(() => _pinnedItem = updated);

    await _sendData({'type': 'claim_item', 'itemId': current.id, 'who': widget.identity, 'title': current.title});
    _addMessage('', '${widget.identity} claimed ${current.title}!', isSystem: true, icon: Icons.celebration_rounded);
    _reactions.addReaction(Reaction.celebrate);
    _reactions.addReaction(Reaction.fire);
  }

  Future<void> _leave() async {
    if (widget.host) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
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
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
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
    if (_error != null) {
      return Scaffold(
        body: SafeArea(
          child: _ErrorView(message: _error!, onBack: () => Navigator.of(context).pop()),
        ),
      );
    }
    final keyboard = MediaQuery.of(context).viewInsets.bottom;

    return Scaffold(
      backgroundColor: Colors.black,
      // The video stays full size under the keyboard; only the overlay moves up.
      resizeToAvoidBottomInset: false,
      body: Stack(
        fit: StackFit.expand,
        children: [
          _videoArea(),
          Positioned.fill(child: FloatingReactionsLayer(controller: _reactions)),
          SafeArea(
            child: Padding(
              padding: EdgeInsets.only(bottom: keyboard),
              child: Column(
                children: [
                  _topBar(),
                  const Spacer(),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(child: _chatList()),
                      if (widget.host) _hostControls(),
                    ],
                  ),
                  PinnedProductBanner(
                    item: _pinnedItem,
                    isHost: widget.host,
                    onPinTap: _openPinDialog,
                    onClaimTap: _claimItem,
                    onUnpinTap: _unpinItem,
                  ),
                  _inputBar(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _topBar() {
    final viewers = _room.remoteParticipants.length + (widget.host ? 0 : 1);
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      child: Row(
        children: [
          _Glass(
            padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AppTag('LIVE', color: DobhaColors.red, icon: Icons.fiber_manual_record, solid: true),
                const SizedBox(width: 8),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 150),
                  child: Text(
                    widget.roomName,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _Glass(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.remove_red_eye_outlined, size: 14),
                const SizedBox(width: 4),
                Text('$viewers', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              ],
            ),
          ),
          const Spacer(),
          _GlassIcon(icon: Icons.close_rounded, onTap: _leave, tooltip: widget.host ? 'End stream' : 'Leave'),
        ],
      ),
    );
  }

  Widget _videoArea() {
    final track = _videoTrack;
    if (track != null) {
      return VideoTrackRenderer(track, fit: VideoViewFit.cover);
    }
    return ColoredBox(
      color: DobhaColors.bg,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppWell(
              circle: true,
              padding: const EdgeInsets.all(22),
              child: Icon(
                widget.host ? Icons.videocam_rounded : Icons.sensors_rounded,
                color: DobhaColors.muted,
                size: 36,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              _connecting ? 'Connecting...' : (widget.host ? 'Starting camera...' : 'Waiting for host...'),
              style: TextStyle(color: DobhaColors.muted, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }

  Widget _hostControls() {
    final local = _room.localParticipant;
    final camOn = local?.isCameraEnabled() ?? false;
    final micOn = local?.isMicrophoneEnabled() ?? false;
    return Padding(
      padding: const EdgeInsets.only(right: 12, bottom: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _GlassIcon(
            icon: Icons.flip_camera_ios_rounded,
            tooltip: 'Flip camera',
            onTap: local == null ? null : _flipCamera,
          ),
          const SizedBox(height: 12),
          _GlassIcon(
            icon: camOn ? Icons.videocam_rounded : Icons.videocam_off_rounded,
            color: camOn ? Colors.white : DobhaColors.red,
            tooltip: camOn ? 'Camera off' : 'Camera on',
            onTap: local == null ? null : () => local.setCameraEnabled(!camOn),
          ),
          const SizedBox(height: 12),
          _GlassIcon(
            icon: micOn ? Icons.mic_rounded : Icons.mic_off_rounded,
            color: micOn ? Colors.white : DobhaColors.red,
            tooltip: micOn ? 'Mute' : 'Unmute',
            onTap: local == null ? null : () => local.setMicrophoneEnabled(!micOn),
          ),
        ],
      ),
    );
  }

  /// Recent messages over the video.
  Widget _chatList() {
    return SizedBox(
      height: 220,
      child: ListView.builder(
        controller: _chatScroll,
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 4),
        itemCount: _messages.length,
        itemBuilder: (_, i) {
          final m = _messages[i];
          return Align(
            alignment: Alignment.centerLeft,
            child: Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: m.isSystem ? DobhaColors.green.withValues(alpha: 0.22) : Colors.black.withValues(alpha: 0.38),
                borderRadius: BorderRadius.circular(14),
              ),
              child: m.isSystem
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(m.icon ?? Icons.info_outline_rounded, size: 14, color: DobhaColors.green),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            m.text,
                            style: TextStyle(color: DobhaColors.green, fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    )
                  : Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: '${m.who}  ',
                            style: TextStyle(color: DobhaColors.green, fontWeight: FontWeight.w700),
                          ),
                          TextSpan(text: m.text),
                        ],
                      ),
                      style: const TextStyle(fontSize: 13, color: Colors.white),
                    ),
            ),
          );
        },
      ),
    );
  }

  Widget _inputBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _chatController,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _sendChat(),
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Say something...',
                hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
                fillColor: Colors.black.withValues(alpha: 0.4),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide(color: DobhaColors.green.withValues(alpha: 0.6)),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          _GlassIcon(
            icon: Icons.send_rounded,
            color: DobhaColors.green,
            tooltip: 'Send',
            onTap: _connecting ? null : _sendChat,
          ),
          const SizedBox(width: 10),
          _GlassIcon(
            icon: Reaction.heart.icon,
            color: Reaction.heart.color,
            tooltip: 'Send love',
            onTap: () => _sendReaction(Reaction.heart),
          ),
        ],
      ),
    );
  }
}

/// Translucent pill for overlays on video, so the picture shows through.
class _Glass extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  const _Glass({required this.child, required this.padding});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(22)),
      child: DefaultTextStyle.merge(
        style: const TextStyle(color: Colors.white),
        child: IconTheme.merge(
          data: const IconThemeData(color: Colors.white),
          child: child,
        ),
      ),
    );
  }
}

class _GlassIcon extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final Color color;
  final String tooltip;
  const _GlassIcon({required this.icon, required this.onTap, required this.tooltip, this.color = Colors.white});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.black.withValues(alpha: 0.4),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap == null
              ? null
              : () {
                  HapticFeedback.selectionClick();
                  onTap!();
                },
          child: Padding(
            padding: const EdgeInsets.all(11),
            child: Icon(icon, size: 22, color: onTap == null ? color.withValues(alpha: 0.4) : color),
          ),
        ),
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
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: DobhaColors.red),
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: onBack, child: const Text('Back')),
          ],
        ),
      ),
    );
  }
}
