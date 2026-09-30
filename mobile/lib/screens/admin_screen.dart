import 'package:flutter/material.dart';

import '../api.dart';
import '../models/app_notification.dart';
import '../models/escrow_order.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/item_photo.dart';
import '../widgets/ui.dart';
import 'feed_screen.dart';

/// Admins only: settle disputed orders and review reported listings.
class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  static Future<void> open(BuildContext context) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminScreen()));

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  List<EscrowOrder>? _disputes;
  List<ReportedItem>? _reports;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([AppState().loadDisputes(), AppState().loadReports()]);
      if (!mounted) return;
      setState(() {
        _disputes = results[0] as List<EscrowOrder>;
        _reports = results[1] as List<ReportedItem>;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _act(Future<void> Function() action, String done) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      messenger.showSnackBar(SnackBar(content: Text(done)));
      await _load();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<bool> _confirm(String title, String body, String action, Color color) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: color, foregroundColor: Colors.white),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(action),
          ),
        ],
      ),
    );
    return ok == true;
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Admin'),
          bottom: TabBar(
            indicatorColor: DobhaColors.green,
            labelColor: DobhaColors.text,
            unselectedLabelColor: DobhaColors.muted,
            tabs: [
              Tab(text: 'Disputes${_disputes == null ? '' : ' (${_disputes!.length})'}'),
              Tab(text: 'Reported${_reports == null ? '' : ' (${_reports!.length})'}'),
            ],
          ),
        ),
        body: _error != null && _disputes == null
            ? Center(child: Text(_error!, style: TextStyle(color: DobhaColors.muted)))
            : _disputes == null
                ? Center(child: CircularProgressIndicator(color: DobhaColors.green))
                : TabBarView(children: [_disputeList(), _reportList()]),
      ),
    );
  }

  Widget _refreshable(List<Widget> children, String emptyText) {
    return RefreshIndicator(
      color: DobhaColors.green,
      backgroundColor: DobhaColors.cardElevated,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: children.isEmpty
            ? [
                const SizedBox(height: 80),
                Icon(Icons.task_alt_rounded, size: 48, color: DobhaColors.muted),
                const SizedBox(height: 12),
                Text(emptyText, textAlign: TextAlign.center, style: TextStyle(color: DobhaColors.muted)),
              ]
            : children,
      ),
    );
  }

  Widget _disputeList() {
    return _refreshable([
      for (final o in _disputes!)
        AppCard(
          margin: const EdgeInsets.only(bottom: 14),
          radius: 20,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  ItemThumb(item: o.item, size: 50),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(o.item.title,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                        Text('#${o.id}', style: TextStyle(fontSize: 11.5, color: DobhaColors.muted)),
                      ],
                    ),
                  ),
                  Text('R ${o.totalZar.toStringAsFixed(0)}',
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: DobhaColors.green)),
                ],
              ),
              const SizedBox(height: 12),
              _line('Buyer', o.buyerName),
              _line('Seller', '${o.item.sellerName} (${o.item.sellerHandle})'),
              _line('Delivery', o.deliveryMethod),
              _line('Tracking', o.trackingNumber.isEmpty ? 'Not dispatched' : o.trackingNumber),
              _line('Paid with', o.paymentMethod),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      color: DobhaColors.red,
                      onPressed: () async {
                        if (await _confirm('Refund the buyer?',
                            'R ${o.totalZar.toStringAsFixed(0)} goes back to ${o.buyerName}\'s wallet. The seller is not paid.', 'Refund', DobhaColors.red)) {
                          _act(() => AppState().resolveDispute(o.id, refund: true), 'Buyer refunded');
                        }
                      },
                      child: const Text('Refund buyer'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppButton(
                      color: DobhaColors.green,
                      onPressed: () async {
                        if (await _confirm('Pay the seller?',
                            'The seller gets R ${o.amountZar.toStringAsFixed(0)} minus the 5% fee. The buyer is not refunded.', 'Pay seller', DobhaColors.greenDark)) {
                          _act(() => AppState().resolveDispute(o.id, refund: false), 'Seller paid');
                        }
                      },
                      child: const Text('Pay seller'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
    ], 'No open disputes.');
  }

  Widget _reportList() {
    return _refreshable([
      for (final r in _reports!)
        AppCard(
          margin: const EdgeInsets.only(bottom: 14),
          radius: 20,
          onTap: () => ItemDetailScreen.open(context, r.item),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  ItemThumb(item: r.item, size: 50),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(r.item.title,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                        Text('${r.item.sellerName} · ${r.item.formattedPrice}',
                            style: TextStyle(fontSize: 11.5, color: DobhaColors.muted)),
                      ],
                    ),
                  ),
                  AppTag('${r.reports} report${r.reports == 1 ? '' : 's'}', color: DobhaColors.red),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [for (final reason in r.reasons) AppTag(reason, color: DobhaColors.amber)],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      onPressed: () => _act(() => AppState().moderateItem(r.item.id, remove: false), 'Reports cleared'),
                      child: const Text('Keep listing'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppButton(
                      color: DobhaColors.red,
                      onPressed: () async {
                        if (await _confirm('Remove this listing?', 'It disappears for everyone and the seller is told why.',
                            'Remove', DobhaColors.red)) {
                          _act(() => AppState().moderateItem(r.item.id, remove: true), 'Listing removed');
                        }
                      },
                      child: const Text('Remove'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
    ], 'No reported listings.');
  }

  Widget _line(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 78, child: Text(label, style: TextStyle(fontSize: 12, color: DobhaColors.muted))),
          Expanded(child: Text(value, style: TextStyle(fontSize: 12, color: DobhaColors.textSecondary))),
        ],
      ),
    );
  }
}
