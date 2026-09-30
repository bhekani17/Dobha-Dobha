import 'package:flutter/material.dart';

import '../api.dart';
import '../models/social.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/ui.dart';
import '../widgets/user_avatar.dart';
import 'seller_screen.dart';

/// Someone's followers and the people they follow, as two tabs.
class FollowListScreen extends StatelessWidget {
  final String userId;
  final String name;
  final bool showFollowing;

  const FollowListScreen({super.key, required this.userId, required this.name, this.showFollowing = false});

  static Future<void> open(BuildContext context, {required String userId, required String name, bool following = false}) =>
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => FollowListScreen(userId: userId, name: name, showFollowing: following)));

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      initialIndex: showFollowing ? 1 : 0,
      child: Scaffold(
        appBar: AppBar(
          title: Text(name),
          bottom: TabBar(
            indicatorColor: DobhaColors.green,
            labelColor: DobhaColors.text,
            unselectedLabelColor: DobhaColors.muted,
            tabs: const [Tab(text: 'Followers'), Tab(text: 'Following')],
          ),
        ),
        body: TabBarView(
          children: [
            _PeopleList(load: () => AppState().loadFollowList(userId, 'followers'), empty: 'No followers yet.'),
            _PeopleList(load: () => AppState().loadFollowList(userId, 'following'), empty: 'Not following anyone yet.'),
          ],
        ),
      ),
    );
  }
}

class _PeopleList extends StatefulWidget {
  final Future<List<PersonRow>> Function() load;
  final String empty;
  const _PeopleList({required this.load, required this.empty});

  @override
  State<_PeopleList> createState() => _PeopleListState();
}

class _PeopleListState extends State<_PeopleList> {
  List<PersonRow>? _people;
  String? _error;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    try {
      final people = await widget.load();
      if (mounted) setState(() => _people = people);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final people = _people;
    if (people == null) {
      return Center(
        child: _error == null ? CircularProgressIndicator(color: DobhaColors.green) : Text(_error!, style: TextStyle(color: DobhaColors.muted)),
      );
    }
    return RefreshIndicator(
      color: DobhaColors.green,
      backgroundColor: DobhaColors.cardElevated,
      onRefresh: _refresh,
      child: people.isEmpty
          ? ListView(children: [
              const SizedBox(height: 100),
              Text(widget.empty, textAlign: TextAlign.center, style: TextStyle(color: DobhaColors.muted)),
            ])
          : ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: people.length,
              itemBuilder: (context, i) => PersonTile(
                person: people[i],
                onChanged: (p) => setState(() => _people = [for (final x in people) x.id == p.id ? p : x]),
              ),
            ),
    );
  }
}

/// Avatar, name and a Follow / Following button; tapping the row opens their profile.
class PersonTile extends StatefulWidget {
  final PersonRow person;
  final ValueChanged<PersonRow>? onChanged;
  const PersonTile({super.key, required this.person, this.onChanged});

  @override
  State<PersonTile> createState() => _PersonTileState();
}

class _PersonTileState extends State<PersonTile> {
  bool _busy = false;

  Future<void> _toggle() async {
    final p = widget.person;
    setState(() => _busy = true);
    try {
      await AppState().setFollowing(p.id, !p.isFollowing);
      widget.onChanged?.call(p.copyWith(isFollowing: !p.isFollowing));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.person;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      leading: UserAvatar(url: p.avatarUrl, name: p.name, size: 44),
      title: Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(
        [p.handle, if (p.isVendor) 'Seller', if (p.followsYou && !p.isMe) 'Follows you'].join(' · '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: DobhaColors.muted, fontSize: 12.5),
      ),
      trailing: p.isMe
          ? null
          : SizedBox(
              width: 108,
              child: AppButton(
                color: p.isFollowing ? null : DobhaColors.green,
                padding: const EdgeInsets.symmetric(vertical: 9),
                onPressed: _busy ? null : _toggle,
                child: Text(p.isFollowing ? 'Following' : (p.followsYou ? 'Follow back' : 'Follow'), style: const TextStyle(fontSize: 13)),
              ),
            ),
      onTap: () => SellerScreen.open(context, p.id),
    );
  }
}
