import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'api.dart';
import 'live_screen.dart';
import 'theme.dart';

void main() => runApp(const DobhaLiveApp());

class DobhaLiveApp extends StatelessWidget {
  const DobhaLiveApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Dobha Dobha Live',
      debugShowCheckedModeBanner: false,
      theme: dobhaTheme(),
      home: const HomeScreen(),
    );
  }
}

/// Lists streams that are live right now, and lets a seller start one.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _serverController = TextEditingController(text: defaultServerUrl());
  final _nameController = TextEditingController();
  final _streamController = TextEditingController();

  List<LiveRoom>? _rooms;
  String? _error;
  Timer? _poll;
  bool _showServer = false;

  Api get _api => Api(_serverController.text.trim());

  @override
  void initState() {
    super.initState();
    _startPolling();
  }

  void _startPolling() {
    _poll?.cancel();
    _loadRooms();
    _poll = Timer.periodic(const Duration(seconds: 5), (_) => _loadRooms());
  }

  Future<void> _loadRooms() async {
    try {
      final rooms = await _api.rooms();
      if (!mounted) return;
      setState(() {
        _rooms = rooms;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _open({required String room, required bool host}) async {
    final identity = _nameController.text.trim();
    if (identity.isEmpty) {
      setState(() => _error = 'Enter your name first');
      return;
    }
    if (room.isEmpty) {
      setState(() => _error = 'Enter a stream name');
      return;
    }
    _poll?.cancel();
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => LiveScreen(api: _api, roomName: room, identity: identity, host: host),
    ));
    _startPolling();
  }

  @override
  void dispose() {
    _poll?.cancel();
    _serverController.dispose();
    _nameController.dispose();
    _streamController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadRooms,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  const Text.rich(
                    TextSpan(children: [
                      TextSpan(text: 'Dobha '),
                      TextSpan(text: 'Live', style: TextStyle(color: DobhaColors.green)),
                    ]),
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  // Dev-only: lets you point the app at your PC's current Wi-Fi IP.
                  // Release builds use SERVER_URL only.
                  if (kDebugMode)
                    TextButton(
                      onPressed: () => setState(() => _showServer = !_showServer),
                      child: const Text('Server'),
                    ),
                ],
              ),
              if (_showServer) ...[
                const SizedBox(height: 8),
                TextField(
                  controller: _serverController,
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                  decoration: const InputDecoration(hintText: 'http://192.168.1.19:3000'),
                  onSubmitted: (_) => _startPolling(),
                ),
              ],
              const SizedBox(height: 16),
              TextField(
                controller: _nameController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(hintText: 'Your name'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: const TextStyle(color: DobhaColors.red, fontSize: 14)),
              ],
              const SizedBox(height: 16),
              _card(Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Go live', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _streamController,
                    autocorrect: false,
                    decoration: const InputDecoration(hintText: 'Stream name (e.g. bale-1)'),
                  ),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: () => _open(room: _streamController.text.trim(), host: true),
                    child: const Text('Go live'),
                  ),
                ],
              )),
              const SizedBox(height: 24),
              const Text('Live now', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              ..._roomList(),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _roomList() {
    final rooms = _rooms;
    if (rooms == null) {
      return [_card(const Text('Loading...', style: TextStyle(color: DobhaColors.muted)))];
    }
    if (rooms.isEmpty) {
      return [_card(const Text('Nobody is live right now.', style: TextStyle(color: DobhaColors.muted)))];
    }
    return [
      for (final r in rooms)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: _card(Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(r.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text(r.viewers == 1 ? '1 viewer' : '${r.viewers} viewers',
                        style: const TextStyle(color: DobhaColors.muted, fontSize: 14)),
                  ],
                ),
              ),
              FilledButton(onPressed: () => _open(room: r.name, host: false), child: const Text('Watch')),
            ],
          )),
        ),
    ];
  }

  Widget _card(Widget child) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: DobhaColors.card, borderRadius: BorderRadius.circular(12)),
        child: child,
      );
}
