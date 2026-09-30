import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/escrow_order.dart';
import '../state/app_state.dart';
import '../theme.dart';

class EscrowTrackerCard extends StatelessWidget {
  final EscrowOrder order;
  final bool isVendorView;

  const EscrowTrackerCard({
    super.key,
    required this.order,
    this.isVendorView = false,
  });

  @override
  Widget build(BuildContext context) {
    final status = order.status;
    final currentStep = status.stepIndex;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: DobhaColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: status == EscrowStatus.payoutReleased
              ? DobhaColors.green.withValues(alpha: 0.3)
              : DobhaColors.escrowIndigo.withValues(alpha: 0.4),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Order Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: DobhaColors.escrowIndigo.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: DobhaColors.escrowIndigo.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.shield_rounded, color: DobhaColors.cyan, size: 12),
                        const SizedBox(width: 4),
                        Text(order.escrowVaultRef, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: DobhaColors.cyan)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('#${order.id}', style: const TextStyle(color: DobhaColors.muted, fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _statusColor(status).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  status.label,
                  style: TextStyle(color: _statusColor(status), fontSize: 11, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Item Info
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: DobhaColors.cardElevated,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: DobhaColors.border),
                ),
                child: const Center(
                  child: Icon(Icons.checkroom_rounded, color: DobhaColors.green, size: 24),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(order.item.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(
                      '${order.item.formattedPrice} + R ${order.shippingFeeZar.toStringAsFixed(0)} shipping (${order.deliveryMethod})',
                      style: const TextStyle(fontSize: 12, color: DobhaColors.muted),
                    ),
                    Text('Tracking: ${order.trackingNumber}', style: const TextStyle(fontSize: 11, color: DobhaColors.textSecondary)),
                  ],
                ),
              ),
              Text(
                'R ${order.totalZar.toStringAsFixed(0)}',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: DobhaColors.green),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Escrow Stepper Lifecycle Diagram
          _buildLifecycleStepper(currentStep),
          const SizedBox(height: 12),

          // Explanatory note
          Text(
            status.description,
            style: const TextStyle(fontSize: 11.5, color: DobhaColors.textSecondary, height: 1.3),
          ),
          const SizedBox(height: 14),

          // Action Buttons based on Role & State
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
      case EscrowStatus.receivedConfirmed:
      case EscrowStatus.payoutReleased:
        return DobhaColors.green;
      case EscrowStatus.disputed:
        return DobhaColors.red;
    }
  }

  Widget _buildLifecycleStepper(int activeStep) {
    const steps = [
      'Buyer Paid\n(Escrow Held)',
      'Vendor\nDispatched',
      'Received\nas Shown',
      'Vendor\nPaid',
    ];

    return Row(
      children: List.generate(steps.length * 2 - 1, (index) {
        if (index.isOdd) {
          final lineStep = index ~/ 2;
          final isCompleted = activeStep > lineStep;
          return Expanded(
            child: Container(
              height: 2,
              color: isCompleted ? DobhaColors.green : DobhaColors.borderLight,
            ),
          );
        }

        final step = index ~/ 2;
        final isDone = activeStep >= step;
        final isCurrent = activeStep == step;

        return Column(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDone ? DobhaColors.green : DobhaColors.cardElevated,
                border: Border.all(
                  color: isCurrent
                      ? DobhaColors.cyan
                      : (isDone ? DobhaColors.green : DobhaColors.borderLight),
                  width: 1.5,
                ),
              ),
              child: Center(
                child: isDone
                    ? const Icon(Icons.check, size: 13, color: Colors.black)
                    : Text('${step + 1}', style: const TextStyle(fontSize: 10, color: DobhaColors.muted, fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 4),
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
      return Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () {
                HapticFeedback.mediumImpact();
                appState.markOrderDispatched(order.id);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    backgroundColor: DobhaColors.cardElevated,
                    content: Text('Simulated Vendor Dispatch for #${order.id} 🚚'),
                  ),
                );
              },
              icon: const Icon(Icons.local_shipping_outlined, size: 16),
              label: const Text('Simulate Vendor Dispatch'),
            ),
          ),
        ],
      );
    }

    if (order.status == EscrowStatus.vendorDispatched) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: DobhaColors.green,
              foregroundColor: Colors.black,
            ),
            onPressed: () {
              HapticFeedback.heavyImpact();
              _showConfirmDialog(context, order);
            },
            icon: const Icon(Icons.verified_rounded, size: 18),
            label: const Text('Confirm "Received as Shown" (Release Funds)'),
          ),
          const SizedBox(height: 6),
          Center(
            child: TextButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Escrow condition mediation ticket logged with Dobha Support.'),
                  ),
                );
              },
              child: const Text('Report Condition Mismatch / Dispute', style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
            ),
          ),
        ],
      );
    }

    if (order.status == EscrowStatus.payoutReleased) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        decoration: BoxDecoration(
          color: DobhaColors.green.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_rounded, color: DobhaColors.green, size: 16),
            SizedBox(width: 8),
            Text('Escrow Settled & Vendor Paid in Full', style: TextStyle(color: DobhaColors.green, fontWeight: FontWeight.w700, fontSize: 12)),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }

  void _showConfirmDialog(BuildContext context, EscrowOrder order) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: DobhaColors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.thumb_up_alt_rounded, color: DobhaColors.green, size: 22),
            SizedBox(width: 10),
            Text('Confirm Item Condition', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Did "${order.item.title}" match the live stream & description?'),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: DobhaColors.cardElevated,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Tapping confirm will permanently release R ${order.amountZar.toStringAsFixed(0)} from the Dobha Escrow Vault to ${order.item.sellerName}.',
                style: const TextStyle(fontSize: 12, color: DobhaColors.textSecondary),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Not Yet')),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              AppState().confirmReceivedAndReleaseEscrow(order.id);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  backgroundColor: DobhaColors.green,
                  content: Text('🎉 Escrow funds released to ${order.item.sellerName}!'),
                ),
              );
            },
            child: const Text('Confirm & Release Payout'),
          ),
        ],
      ),
    );
  }
}
