import 'package:flutter/material.dart';

import '../api.dart';
import '../legal/help.dart';
import '../models/support.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/ui.dart';

/// Answers to common questions, a search over them, and the way to reach Dobha support.
/// Opens from Settings when signed in and from the log in screen when signed out.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  static Future<void> open(BuildContext context) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const HelpScreen()));

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<HelpTopic> get _topics {
    if (_query.isEmpty) return helpTopics;
    final words = _query.toLowerCase().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
    bool matches(HelpQuestion q) {
      final text = '${q.question} ${q.answer}'.toLowerCase();
      return words.every(text.contains);
    }

    return [
      for (final t in helpTopics)
        if (t.questions.any(matches)) HelpTopic(t.title, t.questions.where(matches).toList()),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final topics = _topics;
    final signedIn = AppState().isLoggedIn;
    return Scaffold(
      appBar: AppBar(title: const Text('Help')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            onChanged: (v) => setState(() => _query = v.trim()),
            decoration: InputDecoration(
              hintText: 'Search help, e.g. refund, delivery, payout',
              prefixIcon: const Icon(Icons.search_rounded, size: 20),
              suffixIcon: _query.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18),
                      onPressed: () => setState(() {
                        _search.clear();
                        _query = '';
                      }),
                    ),
            ),
          ),
          const SizedBox(height: 16),
          _ContactCard(signedIn: signedIn),
          const SizedBox(height: 24),
          if (topics.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text('No answers match "$_query". Ask us with Contact support and we will help.',
                  textAlign: TextAlign.center, style: TextStyle(color: DobhaColors.muted, height: 1.4)),
            ),
          for (final topic in topics) ...[
            SectionTitle(topic.title),
            AppCard(
              padding: EdgeInsets.zero,
              margin: const EdgeInsets.only(bottom: 24),
              child: Column(
                children: [
                  for (final (i, q) in topic.questions.indexed) ...[
                    if (i > 0) Divider(height: 1, color: DobhaColors.border),
                    _QuestionTile(q, initiallyExpanded: _query.isNotEmpty && topics.length == 1 && topic.questions.length == 1),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _QuestionTile extends StatelessWidget {
  final HelpQuestion q;
  final bool initiallyExpanded;
  const _QuestionTile(this.q, {this.initiallyExpanded = false});

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        key: PageStorageKey(q.question),
        initiallyExpanded: initiallyExpanded,
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        iconColor: DobhaColors.green,
        collapsedIconColor: DobhaColors.muted,
        expandedAlignment: Alignment.centerLeft,
        title: Text(q.question, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        children: [Text(q.answer, style: TextStyle(color: DobhaColors.textSecondary, height: 1.5, fontSize: 14))],
      ),
    );
  }
}

class _ContactCard extends StatelessWidget {
  final bool signedIn;
  const _ContactCard({required this.signedIn});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      radius: 20,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              AppWell(
                circle: true,
                tint: DobhaColors.green,
                padding: const EdgeInsets.all(10),
                child: Icon(Icons.support_agent_rounded, color: DobhaColors.green, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Still need help?', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    Text('Send us a message. We answer within 2 business days.',
                        style: TextStyle(color: DobhaColors.textSecondary, fontSize: 13, height: 1.35)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  color: DobhaColors.green,
                  onPressed: () => ContactSupportScreen.open(context),
                  child: const Text('Contact support'),
                ),
              ),
              if (signedIn) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: AppButton(
                    onPressed: () => SupportRequestsScreen.open(context),
                    child: const Text('Your questions'),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

/// Write to Dobha support. [orderId] preselects an order (e.g. from an order card).
class ContactSupportScreen extends StatefulWidget {
  final String? orderId;
  final String? topic;
  const ContactSupportScreen({super.key, this.orderId, this.topic});

  static Future<void> open(BuildContext context, {String? orderId, String? topic}) => Navigator.of(context)
      .push(MaterialPageRoute(builder: (_) => ContactSupportScreen(orderId: orderId, topic: topic)));

  @override
  State<ContactSupportScreen> createState() => _ContactSupportScreenState();
}

class _ContactSupportScreenState extends State<ContactSupportScreen> {
  final _message = TextEditingController();
  final _email = TextEditingController();
  late String? _topic = widget.topic ?? (widget.orderId != null ? 'order' : null);
  late String? _orderId = widget.orderId;
  bool _busy = false;
  String? _error;

  static final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  bool get _signedIn => AppState().isLoggedIn;

  @override
  void dispose() {
    _message.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final message = _message.text.trim();
    final email = _email.text.trim();
    String? problem;
    if (_topic == null) {
      problem = 'Pick what your question is about';
    } else if (message.length < 10) {
      problem = 'Tell us a little more so we can help (at least 10 characters)';
    } else if (!_signedIn && !_emailRe.hasMatch(email)) {
      problem = 'Enter your email address so we can answer you';
    }
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppState().contactSupport(
        topic: _topic!,
        message: message,
        orderId: _orderId,
        email: _signedIn ? null : email,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(_signedIn
            ? 'Sent. You will get a notification when we answer.'
            : 'Sent. We will answer by email at $email.'),
      ));
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final orders = _signedIn ? AppState().orders : const [];
    final showOrders = orders.isNotEmpty && (_topic == 'order' || _topic == 'payment');
    return Scaffold(
      appBar: AppBar(title: const Text('Contact support')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          children: [
            Text('What is it about?', style: TextStyle(fontWeight: FontWeight.w600, color: DobhaColors.textSecondary)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final t in supportTopics)
                  AppChip(label: t.label, selected: _topic == t.id, onTap: () => setState(() => _topic = t.id)),
              ],
            ),
            if (showOrders) ...[
              const SizedBox(height: 20),
              DropdownButtonFormField<String?>(
                initialValue: orders.any((o) => o.id == _orderId) ? _orderId : null,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Which order? (optional)'),
                items: [
                  const DropdownMenuItem<String?>(value: null, child: Text('Not about one order')),
                  for (final o in orders)
                    DropdownMenuItem<String?>(
                      value: o.id,
                      child: Text('${o.item.title} (${o.isSeller ? 'sold' : 'bought'})', overflow: TextOverflow.ellipsis),
                    ),
                ],
                onChanged: (v) => setState(() => _orderId = v),
              ),
            ],
            const SizedBox(height: 20),
            TextField(
              controller: _message,
              minLines: 5,
              maxLines: 10,
              maxLength: 2000,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Your message',
                hintText: 'What happened, and what would you like us to do?',
                alignLabelWithHint: true,
              ),
            ),
            if (!_signedIn) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(
                  labelText: 'Your email',
                  helperText: 'Use the email on your Dobha account if you have one.',
                  prefixIcon: Icon(Icons.mail_outline_rounded, size: 19),
                ),
              ),
            ],
            const SizedBox(height: 16),
            if (_error != null)
              AppWell(
                radius: 14,
                tint: DobhaColors.red,
                margin: const EdgeInsets.only(bottom: 14),
                child: Text(_error!, style: TextStyle(color: DobhaColors.red, fontWeight: FontWeight.w600)),
              ),
            AppButton(
              color: DobhaColors.green,
              padding: const EdgeInsets.symmetric(vertical: 16),
              onPressed: _busy ? null : _send,
              child: _busy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : const Text('Send'),
            ),
            const SizedBox(height: 14),
            Text(
              'Never share your password or banking PIN. Dobha support will never ask for them.',
              textAlign: TextAlign.center,
              style: TextStyle(color: DobhaColors.muted, fontSize: 12, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}

/// Questions the signed-in user sent, with our answers.
class SupportRequestsScreen extends StatefulWidget {
  const SupportRequestsScreen({super.key});

  static Future<void> open(BuildContext context) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SupportRequestsScreen()));

  @override
  State<SupportRequestsScreen> createState() => _SupportRequestsScreenState();
}

class _SupportRequestsScreenState extends State<SupportRequestsScreen> {
  List<SupportRequest>? _requests;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final requests = await AppState().loadSupportRequests();
      if (mounted) {
        setState(() {
          _requests = requests;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final requests = _requests;
    final Widget body;
    if (requests == null && _error == null) {
      body = Center(child: CircularProgressIndicator(color: DobhaColors.green));
    } else if (requests == null) {
      body = _Message(icon: Icons.cloud_off_rounded, text: _error!, action: ('Try again', _load));
    } else if (requests.isEmpty) {
      body = _Message(
        icon: Icons.forum_outlined,
        text: 'You have not asked us anything yet.',
        action: ('Contact support', () => ContactSupportScreen.open(context).then((_) => _load())),
      );
    } else {
      body = RefreshIndicator(
        color: DobhaColors.green,
        backgroundColor: DobhaColors.cardElevated,
        onRefresh: _load,
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          itemCount: requests.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (_, i) => _RequestCard(requests[i]),
        ),
      );
    }
    return Scaffold(appBar: AppBar(title: const Text('Your questions')), body: body);
  }
}

class _RequestCard extends StatelessWidget {
  final SupportRequest r;
  const _RequestCard(this.r);

  @override
  Widget build(BuildContext context) {
    final (status, color) = switch (r.status) {
      'answered' => ('Answered', DobhaColors.green),
      'closed' => ('Closed', DobhaColors.muted),
      _ => ('Waiting for us', DobhaColors.textSecondary),
    };
    return AppCard(
      radius: 18,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(supportTopicLabel(r.topic), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              ),
              AppTag(status, color: color),
            ],
          ),
          const SizedBox(height: 2),
          Text(_date(r.createdAt), style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
          const SizedBox(height: 10),
          Text(r.message, style: TextStyle(color: DobhaColors.textSecondary, height: 1.45)),
          if (r.reply != null) ...[
            const SizedBox(height: 12),
            AppWell(
              radius: 14,
              tint: DobhaColors.green,
              width: double.infinity,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Dobha support${r.repliedAt != null ? ', ${_date(r.repliedAt!)}' : ''}',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: DobhaColors.green)),
                  const SizedBox(height: 6),
                  Text(r.reply!, style: const TextStyle(height: 1.45)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _date(DateTime t) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final l = t.toLocal();
    return '${l.day} ${months[l.month - 1]} ${l.year}';
  }
}

class _Message extends StatelessWidget {
  final IconData icon;
  final String text;
  final (String, VoidCallback) action;
  const _Message({required this.icon, required this.text, required this.action});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppWell(circle: true, padding: const EdgeInsets.all(18), child: Icon(icon, size: 34, color: DobhaColors.muted)),
            const SizedBox(height: 14),
            Text(text, textAlign: TextAlign.center, style: TextStyle(color: DobhaColors.muted)),
            const SizedBox(height: 16),
            AppButton(onPressed: action.$2, child: Text(action.$1)),
          ],
        ),
      ),
    );
  }
}
