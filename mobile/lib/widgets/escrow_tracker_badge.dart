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
              AppTag(isVendorView ? 'SALE' : 'PURCHASE', color: isVendorView ? DobhaColors.gold : DobhaColors.cyan),
              const SizedBox(width: 8),
              Expanded(
                child: Text('#${order.id}',
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: DobhaColors.muted, fontSize: 12, fontWeight: FontWeight.w600)),
              ),
              AppTag(status.label, color: _statusColor(status)),
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
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(
                      '${order.item.formattedPrice} + R ${order.shippingFeeZar.toStringAsFixed(0)} shipping (${order.deliveryMethod})',
                      style: TextStyle(fontSize: 12, color: DobhaColors.muted),
                    ),
                    Text(
                      isVendorView ? 'Buyer: ${order.buyerName} · ${order.deliveryAddress}' : 'Tracking: ${order.trackingNumber}',
                      style: TextStyle(fontSize: 11, color: DobhaColors.textSecondary),
                    ),
                    Text('Escrow ref ${order.escrowVaultRef}', style: TextStyle(fontSize: 10.5, color: DobhaColors.muted)),
                  ],
                ),
              ),
              Text('R ${order.totalZar.toStringAsFixed(0)}',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: DobhaColors.green)),
            ],
          ),
          const SizedBox(height: 18),
          if (status != EscrowStatus.disputed) ...[
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
        return DobhaColors.cyan;
      case EscrowStatus.vendorDispatched:
        return DobhaColors.amber;
      case EscrowStatus.payoutReleased:
        return DobhaColors.green;
      case EscrowStatus.disputed:
        return DobhaColors.red;
    }
  }

  Widget _buildLifecycleStepper(int activeStep) {
    const steps = ['Paid\n(Held)', 'Vendor\nDispatched', 'Received\nas Shown', 'Vendor\nPaid'];

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
                fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w500,
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
      if (!isVendorView) {
        return _Notice(icon: Icons.hourglass_top_rounded, text: 'Waiting for the vendor to dispatch', color: DobhaColors.cyan);
      }
      return AppButton(
        onPressed: () {
          HapticFeedback.mediumImpact();
          _act(context, () => appState.dispatchOrder(order.id), 'Order ${order.id} marked as dispatched');
        },
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [Icon(Icons.local_shipping_outlined, size: 17), SizedBox(width: 8), Text('Mark as Dispatched')],
        ),
      );
    }

    if (order.status == EscrowStatus.vendorDispatched) {
      if (isVendorView) {
        return _Notice(icon: Icons.local_shipping_outlined, text: 'In transit, waiting for buyer confirmation', color: DobhaColors.amber);
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
              children: [Icon(Icons.verified_rounded, size: 18), SizedBox(width: 8), Text('Received as Shown')],
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

    if (order.status == EscrowStatus.disputed) {
      return _Notice(icon: Icons.support_agent_rounded, text: 'Dobha support is reviewing this order', color: DobhaColors.red);
    }

    if (order.status == EscrowStatus.payoutReleased) {
      return _Notice(icon: Icons.check_circle_rounded, text: 'Settled and vendor paid in full', color: DobhaColors.green);
    }

    return const SizedBox.shrink();
  }

  void _confirmDispute(BuildContext context, EscrowOrder order) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Report a problem?'),
        content: const Text('The payment stays frozen in escrow while Dobha support looks into it with you and the vendor.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: DobhaColors.red, foregroundColor: Colors.white),
            onPressed: () {
              Navigator.of(ctx).pop();
              _act(context, () => AppState().disputeOrder(order.id), 'Problem reported. Support will be in touch.');
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
            Icon(Icons.thumb_up_alt_rounded, color: DobhaColors.green, size: 22),
            SizedBox(width: 10),
            Text('Confirm Condition', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Did "${order.item.title}" match the live stream and description?'),
            const SizedBox(height: 12),
            AppWell(
              radius: 14,
              child: Text(
                'Confirming releases R ${order.amountZar.toStringAsFixed(0)} from escrow to ${order.item.sellerName}. This cannot be undone.',
                style: TextStyle(fontSize: 12, color: DobhaColors.textSecondary),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Not Yet')),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _act(context, () => AppState().confirmOrder(order.id), 'Funds released to ${order.item.sellerName}');
            },
            child: const Text('Confirm & Release'),
          ),
        ],
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color color;

  const _Notice({required this.icon, required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return AppWell(
      radius: 14,
      tint: color,
      padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 8),
          Flexible(child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12))),
        ],
      ),
    );
  }
}
