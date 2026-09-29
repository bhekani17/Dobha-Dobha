import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';

import 'api.dart';
import 'theme.dart';

/// One live stream. Hosts publish camera + mic; viewers watch. Everyone can chat.
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
  _ChatMessage(this.who, this.text);
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

  bool _connecting = true;
  bool _leaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _room.addListener(_refresh);
    _listener
      ..on<DataReceivedEvent>(_onData)
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

  void _onData(DataReceivedEvent e) {
    try {
      final msg = jsonDecode(utf8.decode(e.data));
      if (msg['type'] == 'chat') _addMessage(e.participant?.name ?? 'someone', msg['text'] as String);
    } catch (_) {
      // Ignore payloads that are not our chat format.
    }
  }

  void _addMessage(String who, String text) {
    setState(() => _messages.add(_ChatMessage(who, text)));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_chatScroll.hasClients) _chatScroll.jumpTo(_chatScroll.position.maxScrollExtent);
    });
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

  Future<void> _leave() async {
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
                  Expanded(flex: 3, child: _videoArea()),
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
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: DobhaColors.red, borderRadius: BorderRadius.circular(4)),
            child: const Text('LIVE', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text(widget.roomName,
                overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          const SizedBox(width: 10),
          Text(people == 1 ? '1 person' : '$people people', style: const TextStyle(color: DobhaColors.muted)),
          const Spacer(),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: DobhaColors.red, foregroundColor: Colors.white),
            onPressed: _leave,
            child: Text(widget.host ? 'End stream' : 'Leave'),
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
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: local == null ? null : () => local.setCameraEnabled(!camOn),
              child: Text(camOn ? 'Camera off' : 'Camera on'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: OutlinedButton(
              onPressed: local == null ? null : () => local.setMicrophoneEnabled(!micOn),
              child: Text(micOn ? 'Mute' : 'Unmute'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _chat() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: DobhaColors.card, borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _chatScroll,
              itemCount: _messages.length,
              itemBuilder: (_, i) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text.rich(TextSpan(children: [
                  TextSpan(
                      text: '${_messages[i].who} ',
                      style: const TextStyle(color: DobhaColors.green, fontWeight: FontWeight.w700)),
                  TextSpan(text: _messages[i].text),
                ])),
              ),
            ),
          ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _chatController,
                  decoration: const InputDecoration(hintText: 'Say something'),
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _sendChat(),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(onPressed: _connecting ? null : _sendChat, child: const Text('Send')),
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
