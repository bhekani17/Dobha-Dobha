import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../models/social.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'checkout_modal.dart';
import 'item_photo.dart';
import 'ui.dart';

/// Asks for a rand amount; returns null when cancelled.
Future<double?> askAmount(BuildContext context, {required String title, required String hint, required String action}) {
  final ctrl = TextEditingController();
  return showDialog<double>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(hint, style: TextStyle(fontSize: 13, color: DobhaColors.textSecondary, height: 1.4)),
          const SizedBox(height: 14),
          TextField(
            controller: ctrl,
            autofocus: true,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(labelText: 'Amount', prefixText: 'R '),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
        ListenableBuilder(
          listenable: ctrl,
          builder: (ctx, _) {
            final amount = double.tryParse(ctrl.text) ?? 0;
            return FilledButton(onPressed: amount <= 0 ? null : () => Navigator.of(ctx).pop(amount), child: Text(action));
          },
        ),
      ],
    ),
  );
}

/// The "Make an offer" flow for a listing.
Future<void> makeOfferFlow(BuildContext context, ThriftItem item) async {
  final messenger = ScaffoldMessenger.of(context);
  final amount = await askAmount(
    context,
    title: 'Make an offer',
    hint: '${item.title} is listed at ${item.formattedPrice}. If the seller accepts, you have 48 hours to buy it at your price.',
    action: 'Send offer',
  );
  if (amount == null) return;
  try {
    await AppState().makeOffer(item, amount);
    messenger.showSnackBar(const SnackBar(content: Text('Offer sent. You will be notified when the seller answers.')));
  } on ApiException catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(e.message)));
  }
}

/// One offer in the Orders tab, with the buttons that make sense for who is looking.
class OfferCard extends StatelessWidget {
  final Offer offer;
  const OfferCard({super.key, required this.offer});

  Future<void> _act(BuildContext context, String action, String done, {double? amount}) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await AppState().respondToOffer(offer.id, action, amountZar: amount);
      messenger.showSnackBar(SnackBar(content: Text(done)));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  String get _status {
    final o = offer;
    if (o.isSeller) {
      return switch (o.status) {
        'pending' => '${o.buyerName} offered ${o.formattedAmount}',
        'countered' => 'You countered with ${o.formattedAmount}. Waiting for ${o.buyerName}.',
        'accepted' => 'Agreed at ${o.formattedAmount}. Waiting for ${o.buyerName} to pay.',
        _ => o.formattedAmount,
      };
    }
    return switch (o.status) {
      'pending' => 'You offered ${o.formattedAmount}. Waiting for the seller.',
      'countered' => 'The seller asks ${o.formattedAmount} instead',
      'accepted' => 'Accepted at ${o.formattedAmount}. Buy it before ${_deadline()}.',
      _ => o.formattedAmount,
    };
  }

  String _deadline() {
    final t = offer.expiresAt?.toLocal();
    if (t == null) return 'it expires';
    return '${t.day}/${t.month} ${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final o = offer;
    return AppCard(
      margin: const EdgeInsets.only(bottom: 14),
      radius: 20,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              ItemThumb(item: o.item, size: 52),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(o.isSeller ? 'Offer on your listing' : 'Your offer',
                        style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
                    Text(o.item.title,
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    Text('Listed at ${o.item.formattedPrice}', style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
                  ],
                ),
              ),
              Text(o.formattedAmount, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17, color: DobhaColors.green)),
            ],
          ),
          const SizedBox(height: 12),
          Text(_status, style: TextStyle(fontSize: 13, color: DobhaColors.textSecondary, height: 1.35)),
          const SizedBox(height: 12),
          ..._actions(context),
        ],
      ),
    );
  }

  List<Widget> _actions(BuildContext context) {
    final o = offer;
    Widget row(List<Widget> buttons) => Row(
          children: [
            for (var i = 0; i < buttons.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(child: buttons[i]),
            ],
          ],
        );

    if (o.isSeller && o.status == 'pending') {
      return [
        row([
          AppButton(onPressed: () => _act(context, 'decline', 'Offer declined'), child: const Text('Decline')),
          AppButton(
            onPressed: () async {
              final amount = await askAmount(
                context,
                title: 'Counter offer',
                hint: 'They offered ${o.formattedAmount} for a piece listed at ${o.item.formattedPrice}. Name a price in between.',
                action: 'Send',
              );
              if (amount != null && context.mounted) _act(context, 'counter', 'Counter offer sent', amount: amount);
            },
            child: const Text('Counter'),
          ),
          AppButton(color: DobhaColors.green, onPressed: () => _act(context, 'accept', 'Offer accepted'), child: const Text('Accept')),
        ]),
      ];
    }
    if (!o.isSeller && o.status == 'countered') {
      return [
        row([
          AppButton(onPressed: () => _act(context, 'decline', 'Counter offer declined'), child: const Text('Decline')),
          AppButton(
              color: DobhaColors.green,
              onPressed: () => _act(context, 'accept', 'Accepted. Buy it within 48 hours.'),
              child: Text('Accept ${o.formattedAmount}')),
        ]),
      ];
    }
    if (!o.isSeller && o.status == 'accepted') {
      return [
        AppButton(
          color: DobhaColors.green,
          onPressed: () => CheckoutModal.show(context, o.item, offer: o),
          child: Text('Buy for ${o.formattedAmount}'),
        ),
      ];
    }
    if (!o.isSeller && o.status == 'pending') {
      return [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => _act(context, 'cancel', 'Offer cancelled'),
            child: Text('Cancel offer', style: TextStyle(color: DobhaColors.muted)),
          ),
        ),
      ];
    }
    return const [];
  }
}
