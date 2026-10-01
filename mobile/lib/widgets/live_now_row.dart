import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../live_screen.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'user_avatar.dart';

/// Opens a live stream as a viewer.
void watchLive(BuildContext context, String roomName) {
  final state = AppState();
  Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => LiveScreen(api: state.api, roomName: roomName, identity: state.user.name, host: false)),
  );
}

/// Who is live right now, as a row of circles across the top of Home. Hidden when nobody is live.
class LiveNowRow extends StatefulWidget {
  const LiveNowRow({super.key});

  @override
  State<LiveNowRow> createState() => _LiveNowRowState();
}

class _LiveNowRowState extends State<LiveNowRow> {
  List<LiveRoom> _rooms = const [];
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    // Skip the check while Home is in the background (another tab or a pushed screen).
    if (!TickerMode.valuesOf(context).enabled && _rooms.isNotEmpty) return;
    try {
      final rooms = await AppState().api.rooms();
      if (mounted) setState(() => _rooms = rooms);
    } catch (_) {
      // Keep what we had; the next check tries again.
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOutCubic,
      alignment: Alignment.topLeft,
      child: _rooms.isEmpty
          ? const SizedBox(width: double.infinity)
          : SizedBox(
              height: 92,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: _rooms.length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (context, i) => _LiveCircle(room: _rooms[i]),
              ),
            ),
    );
  }
}

class _LiveCircle extends StatelessWidget {
  final LiveRoom room;
  const _LiveCircle({required this.room});

  @override
  Widget build(BuildContext context) {
    final name = room.hostName ?? room.name;
    return Semantics(
      button: true,
      label: '$name is live, ${room.viewers} watching',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: () => watchLive(context, room.name),
        child: SizedBox(
          width: 68,
          child: Column(
            children: [
              Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.bottomCenter,
                children: [
                  Container(
                    padding: const EdgeInsets.all(2.5),
                    decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: DobhaColors.red, width: 2.5)),
                    child: UserAvatar(url: room.hostAvatarUrl, name: name, size: 54),
                  ),
                  Positioned(
                    bottom: -6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: DobhaColors.red, borderRadius: BorderRadius.circular(6)),
                      child: const Text('LIVE',
                          style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w700, letterSpacing: 0.4)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
