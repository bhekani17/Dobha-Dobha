import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../models/social.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/ui.dart';
import '../widgets/user_avatar.dart';
import 'seller_screen.dart';

String _time(DateTime t) {
  final local = t.toLocal();
  final now = DateTime.now();
  final hm = '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  if (local.year == now.year && local.month == now.month && local.day == now.day) return hm;
  return '${local.day}/${local.month} $hm';
}

/// Everyone you have messaged, latest first.
class ChatsScreen extends StatefulWidget {
  const ChatsScreen({super.key});

  static Future<void> open(BuildContext context) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ChatsScreen()));

  @override
  State<ChatsScreen> createState() => _ChatsScreenState();
}

class _ChatsScreenState extends State<ChatsScreen> {
  List<ChatSummary>? _chats;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final chats = await AppState().loadChats();
      if (mounted) setState(() => _chats = chats);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final chats = _chats;
    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: chats == null
          ? Center(
              child: _error == null
                  ? CircularProgressIndicator(color: DobhaColors.green)
                  : Text(_error!, style: TextStyle(color: DobhaColors.muted)))
          : RefreshIndicator(
              color: DobhaColors.green,
              backgroundColor: DobhaColors.cardElevated,
              onRefresh: _load,
              child: chats.isEmpty
                  ? ListView(
                      children: [
                        const SizedBox(height: 120),
                        Icon(Icons.chat_bubble_outline_rounded, size: 48, color: DobhaColors.muted),
                        const SizedBox(height: 12),
                        Text('No messages yet.\nAsk a seller about a piece from its details.',
                            textAlign: TextAlign.center, style: TextStyle(color: DobhaColors.muted, height: 1.4)),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: chats.length,
                      separatorBuilder: (_, _) => Divider(height: 1, indent: 76, color: DobhaColors.border),
                      itemBuilder: (context, i) {
                        final c = chats[i];
                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                          leading: UserAvatar(url: c.avatarUrl, name: c.name, size: 46),
                          title: Text(c.name, style: TextStyle(fontWeight: c.unread > 0 ? FontWeight.w700 : FontWeight.w500)),
                          subtitle: Text(
                            '${c.lastFromMe ? 'You: ' : ''}${c.lastMessage}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: c.unread > 0 ? DobhaColors.text : DobhaColors.muted),
                          ),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(_time(c.updatedAt), style: TextStyle(fontSize: 11, color: DobhaColors.muted)),
                              if (c.unread > 0) ...[
                                const SizedBox(height: 4),
                                Badge(label: Text('${c.unread}'), backgroundColor: DobhaColors.green, textColor: Colors.black),
                              ],
                            ],
                          ),
                          onTap: () async {
                            await ChatScreen.open(context, userId: c.userId, name: c.name);
                            _load();
                          },
                        );
                      },
                    ),
            ),
    );
  }
}

/// A conversation with one person, optionally started about a listing.
class ChatScreen extends StatefulWidget {
  final String userId;
  final String name;

  /// Shown above the box until the first message is sent, and attached to it.
  final ThriftItem? about;

  const ChatScreen({super.key, required this.userId, required this.name, this.about});

  static Future<void> open(BuildContext context, {required String userId, required String name, ThriftItem? about}) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => ChatScreen(userId: userId, name: name, about: about)));

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  List<ChatMessage>? _messages;
  ThriftItem? _about;
  bool _sending = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _about = widget.about;
    _load();
    // New replies show up while the conversation is open.
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final messages = await AppState().loadChat(widget.userId);
      if (!mounted) return;
      final grew = messages.length != (_messages?.length ?? -1);
      setState(() => _messages = messages);
      if (grew) _scrollToEnd();
    } on ApiException catch (e) {
      if (mounted && _messages == null) {
        setState(() => _messages = const []);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
    });
  }

  Future<void> _send() async {
    final text = _text.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await AppState().sendMessage(widget.userId, text, itemId: _about?.id);
      _text.clear();
      _about = null;
      await _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final messages = _messages;
    return Scaffold(
      appBar: AppBar(
        title: GestureDetector(
          onTap: () => SellerScreen.open(context, widget.userId),
          child: Text(widget.name),
        ),
        actions: [
          IconButton(
            tooltip: 'View profile',
            icon: const Icon(Icons.person_outline_rounded),
            onPressed: () => SellerScreen.open(context, widget.userId),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: messages == null
                ? Center(child: CircularProgressIndicator(color: DobhaColors.green))
                : messages.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(32),
                          child: Text('Say hi. Ask about sizing, more photos or collecting it.',
                              textAlign: TextAlign.center, style: TextStyle(color: DobhaColors.muted, height: 1.4)),
                        ),
                      )
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                        itemCount: messages.length,
                        itemBuilder: (context, i) => _Bubble(messages[i]),
                      ),
          ),
          if (_about != null)
            Container(
              margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
              padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
              decoration: Surfaces.well(radius: 12),
              child: Row(
                children: [
                  Icon(Icons.sell_outlined, size: 16, color: DobhaColors.green),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('About: ${_about!.title} (${_about!.formattedPrice})',
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                  ),
                  IconButton(
                    tooltip: 'Not about this piece',
                    icon: Icon(Icons.close_rounded, size: 18, color: DobhaColors.muted),
                    onPressed: () => setState(() => _about = null),
                  ),
                ],
              ),
            ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 8, 10),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _text,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 1000,
                      buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(hintText: 'Message'),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 4),
                  IconButton(
                    tooltip: 'Send',
                    onPressed: _sending ? null : _send,
                    icon: _sending
                        ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: DobhaColors.green))
                        : Icon(Icons.send_rounded, color: DobhaColors.green),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  final ChatMessage m;
  const _Bubble(this.m);

  @override
  Widget build(BuildContext context) {
    final mine = m.fromMe;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.fromLTRB(12, 9, 12, 7),
          decoration: BoxDecoration(
            color: mine ? DobhaColors.green : DobhaColors.surface,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(mine ? 16 : 4),
              bottomRight: Radius.circular(mine ? 4 : 16),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (m.item != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    'About: ${m.item!.title}${m.item!.priceZar == null ? '' : ' (R ${m.item!.priceZar!.toStringAsFixed(0)})'}',
                    style: TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w600, color: mine ? Colors.black.withValues(alpha: 0.7) : DobhaColors.muted),
                  ),
                ),
              Text(m.text, style: TextStyle(color: mine ? Colors.black : DobhaColors.text, fontSize: 14.5, height: 1.3)),
              const SizedBox(height: 2),
              Align(
                alignment: Alignment.bottomRight,
                child: Text(_time(m.createdAt),
                    style: TextStyle(fontSize: 10.5, color: mine ? Colors.black.withValues(alpha: 0.6) : DobhaColors.muted)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Speech-bubble button with the unread count; opens [ChatsScreen].
class MessagesButton extends StatelessWidget {
  const MessagesButton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final n = AppState().unreadMessages;
        return Semantics(
          label: n == 0 ? 'Messages' : 'Messages, $n unread',
          child: Badge(
            isLabelVisible: n > 0,
            label: Text(n > 9 ? '9+' : '$n'),
            backgroundColor: DobhaColors.green,
            textColor: Colors.black,
            child: AppButton.icon(
              icon: Icons.chat_bubble_outline_rounded,
              size: 19,
              padding: 10,
              onPressed: () => ChatsScreen.open(context),
            ),
          ),
        );
      },
    );
  }
}
