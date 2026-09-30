import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../models/escrow_order.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'item_photo.dart';
import 'ui.dart';

class EscrowTrackerCard extends StatelessWidget {
  final EscrowOrder order;

  const EscrowTrackerCard({super.key, required this.order});

  bool get isVendorView => order.isSeller;

  static Future<void> _act(BuildContext context, Future<void> Function() action, String done) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      messenger.showSnackBar(SnackBar(content: Text(done)));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = order.status;

    return AppCard(
      margin: const EdgeInsets.only(bottom: 18),
      radius: 24,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(isVendorView ? 'You sold' : 'You bought',
                  style: TextStyle(color: DobhaColors.muted, fontSize: 12.5, fontWeight: FontWeight.w600)),
              const Spacer(),
              AppTag(status.label(isSeller: isVendorView), color: _statusColor(status)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ItemThumb(item: order.item, size: 50),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(order.item.title,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(order.deliveryMethod, style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
                    if (isVendorView)
                      Text('To ${order.buyerName}, ${order.deliveryAddress}',
                          style: TextStyle(fontSize: 12, color: DobhaColors.textSecondary))
                    else if (order.trackingNumber.isNotEmpty && !order.isHubCollection)
                      Text('Tracking ${order.trackingNumber}', style: TextStyle(fontSize: 12, color: DobhaColors.textSecondary)),
                  ],
                ),
              ),
              Text('R ${order.totalZar.toStringAsFixed(0)}',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: DobhaColors.green)),
            ],
          ),
          const SizedBox(height: 18),
          if (status.stepIndex >= 0) ...[
            AppWell(
              radius: 18,
              padding: const EdgeInsets.fromLTRB(10, 14, 10, 12),
              child: _buildLifecycleStepper(status.stepIndex),
            ),
            const SizedBox(height: 12),
          ],
          Text(status.description(isSeller: isVendorView), style: TextStyle(fontSize: 11.5, color: DobhaColors.textSecondary, height: 1.35)),
          const SizedBox(height: 14),
          _buildActionRow(context, order),
        ],
      ),
    );
  }

  Color _statusColor(EscrowStatus status) {
    switch (status) {
      case EscrowStatus.paymentHeld:
        return isVendorView ? DobhaColors.green : DobhaColors.muted;
      case EscrowStatus.vendorDispatched:
        return DobhaColors.green;
      case EscrowStatus.payoutReleased:
        return DobhaColors.green;
      case EscrowStatus.disputed:
        return DobhaColors.red;
      case EscrowStatus.refunded:
        return DobhaColors.muted;
    }
  }

  Widget _buildLifecycleStepper(int activeStep) {
    const steps = ['Paid', 'Sent', 'Received', 'Seller\npaid'];

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(steps.length * 2 - 1, (index) {
        if (index.isOdd) {
          final isCompleted = activeStep > index ~/ 2;
          return Expanded(
            child: Container(
              margin: const EdgeInsets.only(top: 11),
              height: 3,
              decoration: BoxDecoration(
                color: isCompleted ? DobhaColors.green : DobhaColors.cardElevated,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          );
        }

        final step = index ~/ 2;
        final isDone = activeStep >= step;
        final isCurrent = activeStep == step;

        return Column(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: isDone
                  ? BoxDecoration(color: DobhaColors.green, shape: BoxShape.circle)
                  : Surfaces.card(circle: true),
              child: Center(
                child: isDone
                    ? const Icon(Icons.check, size: 14, color: Colors.black)
                    : Text('${step + 1}', style: TextStyle(fontSize: 10, color: DobhaColors.muted, fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              steps[step],
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 9,
                fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                color: isCurrent ? DobhaColors.text : DobhaColors.muted,
              ),
            ),
          ],
        );
      }),
    );
  }

  Widget _buildActionRow(BuildContext context, EscrowOrder order) {
    final appState = AppState();

    if (order.status == EscrowStatus.paymentHeld) {
      if (!isVendorView) return const SizedBox.shrink();
      return AppButton(
        onPressed: () {
          HapticFeedback.mediumImpact();
          if (order.isHubCollection) {
            _act(context, () => appState.dispatchOrder(order.id), 'Marked as sent');
          } else {
            _askTracking(context, order);
          }
        },
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [Icon(Icons.local_shipping_outlined, size: 17), SizedBox(width: 8), Text("I've sent it")],
        ),
      );
    }

    if (order.status == EscrowStatus.vendorDispatched) {
      if (isVendorView) {
        return const SizedBox.shrink();
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppButton(
            color: DobhaColors.green,
            onPressed: () {
              HapticFeedback.heavyImpact();
              _showConfirmDialog(context, order);
            },
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [Icon(Icons.check_rounded, size: 18), SizedBox(width: 8), Text('I got it, all good')],
            ),
          ),
          const SizedBox(height: 6),
          Center(
            child: TextButton(
              onPressed: () => _confirmDispute(context, order),
              child: Text('Report a problem', style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
            ),
          ),
        ],
      );
    }

    // Disputed, refunded and done orders need nothing from the user; the sentence above says it all.
    return const SizedBox.shrink();
  }

  /// Couriers give a tracking number; the buyer sees it and is notified.
  void _askTracking(BuildContext context, EscrowOrder order) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add tracking number'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('From your ${order.deliveryMethod} receipt. The buyer uses it to follow the parcel.',
                style: TextStyle(fontSize: 12.5, color: DobhaColors.textSecondary)),
            const SizedBox(height: 14),
            TextField(
              controller: ctrl,
              autofocus: true,
              textCapitalization: TextCapitalization.characters,
              maxLength: 40,
              decoration: const InputDecoration(labelText: 'Tracking number'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
          ListenableBuilder(
            listenable: ctrl,
            builder: (ctx, _) => FilledButton(
              onPressed: ctrl.text.trim().length < 4
                  ? null
                  : () {
                      Navigator.of(ctx).pop();
                      _act(context, () => AppState().dispatchOrder(order.id, trackingNumber: ctrl.text.trim()),
                          'Marked as sent');
                    },
              child: const Text('Mark as sent'),
            ),
          ),
        ],
      ),
    );
  }

  void _confirmDispute(BuildContext context, EscrowOrder order) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Report a problem?'),
        content: const Text('We keep the money on hold while Dobha support sorts it out with you and the seller.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: DobhaColors.red, foregroundColor: Colors.white),
            onPressed: () {
              Navigator.of(ctx).pop();
              _act(context, () => AppState().disputeOrder(order.id), 'Problem reported. Dobha support will be in touch.');
            },
            child: const Text('Report'),
          ),
        ],
      ),
    );
  }

  void _showConfirmDialog(BuildContext context, EscrowOrder order) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.check_circle_rounded, color: DobhaColors.green, size: 22),
            SizedBox(width: 10),
            Text('Got it?', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Is "${order.item.title}" what you expected from the photos and description?'),
            const SizedBox(height: 12),
            AppWell(
              radius: 14,
              child: Text(
                'This pays ${order.item.sellerName} R ${order.amountZar.toStringAsFixed(0)}. You cannot undo it, so report a problem instead if something is wrong.',
                style: TextStyle(fontSize: 12, color: DobhaColors.textSecondary),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Not yet')),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _act(context, () => AppState().confirmOrder(order.id), '${order.item.sellerName} has been paid');
            },
            child: const Text('Yes, pay the seller'),
          ),
        ],
      ),
    );
  }
}
