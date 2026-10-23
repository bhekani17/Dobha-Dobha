import 'package:flutter/material.dart';

import '../api.dart';
import '../models/escrow_order.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../screens/seller_screen.dart';
import '../screens/support_screens.dart';
import '../screens/payfast_checkout_screen.dart';
import 'item_photo.dart';
import 'ui.dart';

class EscrowTrackerCard extends StatelessWidget {
  final EscrowOrder order;

  const EscrowTrackerCard({super.key, required this.order});

  bool get isVendorView => order.isSeller;

  static Future<void> _act(
    BuildContext context,
    Future<void> Function() action,
    String done,
  ) async {
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
      radius: 20,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                isVendorView ? 'You sold' : 'You bought',
                style: TextStyle(
                  color: DobhaColors.muted,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (order.sandbox) AppTag('TEST', color: DobhaColors.amber),
              if (order.sandbox) const SizedBox(width: 6),
              AppTag(
                status.label(isSeller: isVendorView),
                color: _statusColor(status),
              ),
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
                    Text(
                      order.item.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      order.deliveryMethod,
                      style: TextStyle(fontSize: 12, color: DobhaColors.muted),
                    ),
                    if (isVendorView)
                      Text(
                        'To ${order.buyerName}, ${order.deliveryAddress}',
                        style: TextStyle(
                          fontSize: 12,
                          color: DobhaColors.textSecondary,
                        ),
                      )
                    else if (order.trackingNumber.isNotEmpty &&
                        !order.isHubCollection)
                      Text(
                        'Tracking ${order.trackingNumber}',
                        style: TextStyle(
                          fontSize: 12,
                          color: DobhaColors.textSecondary,
                        ),
                      ),
                    if (order.providerTransactionId != null)
                      Text(
                        'Provider test ID ${order.providerTransactionId}',
                        style: TextStyle(
                          fontSize: 11,
                          color: DobhaColors.textSecondary,
                        ),
                      ),
                  ],
                ),
              ),
              Text(
                'R ${order.totalZar.toStringAsFixed(0)}',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: DobhaColors.green,
                  letterSpacing: -0.3,
                ),
              ),
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
          Text(
            status.description(),
            style: TextStyle(
              fontSize: 12,
              color: DobhaColors.textSecondary,
              height: 1.35,
            ),
          ),
          if (order.sandbox) ...[
            const SizedBox(height: 6),
            Text(
              'Payment status: ${order.paymentStatus}. This does not confirm real payment or delivery.',
              style: TextStyle(fontSize: 11, color: DobhaColors.textSecondary),
            ),
          ],
          const SizedBox(height: 14),
          _buildActionRow(context, order),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () =>
                  ContactSupportScreen.open(context, orderId: order.id),
              icon: Icon(
                Icons.support_agent_rounded,
                size: 16,
                color: DobhaColors.muted,
              ),
              label: Text(
                'Get help with this order',
                style: TextStyle(color: DobhaColors.muted, fontSize: 12),
              ),
            ),
          ),
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
      case EscrowStatus.sellerApprovalPending:
      case EscrowStatus.sellerAccepted:
      case EscrowStatus.sandboxPaymentVerified:
      case EscrowStatus.preparingTest:
      case EscrowStatus.readyForCollectionTest:
      case EscrowStatus.readyForCourierTest:
      case EscrowStatus.inTransitTest:
      case EscrowStatus.deliveryReportedTest:
      case EscrowStatus.buyerConfirmedTest:
      case EscrowStatus.escrowSandboxTransactionCreated:
        return DobhaColors.amber;
      case EscrowStatus.sellerDeclined:
      case EscrowStatus.cancelled:
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
                color: isCompleted
                    ? DobhaColors.green
                    : DobhaColors.cardElevated,
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
                  ? BoxDecoration(
                      color: DobhaColors.green,
                      shape: BoxShape.circle,
                    )
                  : Surfaces.card(circle: true),
              child: Center(
                child: isDone
                    ? const Icon(Icons.check, size: 14, color: Colors.black)
                    : Text(
                        '${step + 1}',
                        style: TextStyle(
                          fontSize: 10,
                          color: DobhaColors.muted,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
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
    if (order.sandbox) return _buildSandboxActions(context, order);
    if (order.status == EscrowStatus.paymentHeld ||
        order.status == EscrowStatus.vendorDispatched) {
      return const SizedBox.shrink();
    }
    if (order.canReview) {
      return AppButton(
        color: DobhaColors.green,
        onPressed: () => _rate(context, order),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.star_rounded, size: 18),
            SizedBox(width: 8),
            Text('Rate the seller'),
          ],
        ),
      );
    }
    if (order.reviewRating != null) {
      return Row(
        children: [
          Text(
            isVendorView ? 'Buyer rated you ' : 'You rated ',
            style: TextStyle(fontSize: 13, color: DobhaColors.muted),
          ),
          StarRow(rating: order.reviewRating!, size: 16),
        ],
      );
    }
    // Disputed, refunded and other finished orders need nothing from the user; the sentence above says it all.
    return const SizedBox.shrink();
  }

  Widget _buildSandboxActions(BuildContext context, EscrowOrder order) {
    final actions = <(String label, String action)>[];
    if (order.status == EscrowStatus.sellerApprovalPending && isVendorView) {
      actions.add(('Accept test order', 'accept'));
      actions.add(('Decline', 'decline'));
    } else if (order.status == EscrowStatus.sellerAccepted && !isVendorView) {
      actions.add((
        order.paymentMethod == 'escrow_sandbox'
            ? 'Create Escrow test transaction'
            : 'Start PayFast test checkout',
        'payment-session',
      ));
      if (order.paymentStatus == 'not_started') {
        actions.add(('Cancel test order', 'cancel-test'));
      }
    } else if (order.status == EscrowStatus.escrowSandboxTransactionCreated) {
      actions.add(('Refresh test status', 'escrow-refresh-test'));
    } else if (order.status == EscrowStatus.sandboxPaymentVerified &&
        isVendorView) {
      actions.add(('Start preparing (test)', 'prepare'));
    } else if (order.status == EscrowStatus.preparingTest && isVendorView) {
      actions.add(('Mark ready (test)', 'ready'));
    } else if (order.status == EscrowStatus.readyForCourierTest &&
        isVendorView) {
      actions.add(('Dispatch (manual test)', 'dispatch-test'));
    } else if ((order.status == EscrowStatus.readyForCollectionTest ||
            order.status == EscrowStatus.inTransitTest) &&
        isVendorView) {
      actions.add(('Report handoff (test)', 'deliver-test'));
    } else if (order.status == EscrowStatus.deliveryReportedTest &&
        !isVendorView) {
      actions.add(('Report completion (test)', 'confirm-test'));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (order.status == EscrowStatus.sellerApprovalPending && !isVendorView)
          Text(
            'Waiting for the seller to accept. No payment has been made.',
            style: TextStyle(color: DobhaColors.textSecondary, fontSize: 12),
          ),
        if (order.status == EscrowStatus.sellerAccepted && isVendorView)
          Text(
            'You accepted this test order. The buyer must continue to test checkout; no payment has been made.',
            style: TextStyle(color: DobhaColors.textSecondary, fontSize: 12),
          ),
        if (actions.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final (label, action) in actions)
                AppButton(
                  color: action == 'decline' || action == 'cancel-test'
                      ? DobhaColors.cardElevated
                      : DobhaColors.green,
                  onPressed: () => _sandboxAction(context, order, action),
                  child: Text(label),
                ),
            ],
          ),
      ],
    );
  }

  Future<void> _sandboxAction(
    BuildContext context,
    EscrowOrder order,
    String action,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    try {
      final response = await AppState().sandboxOrderAction(order.id, action);
      if (action == 'payment-session') {
        if (order.paymentMethod == 'escrow_sandbox') {
          await AppState().loadOrders();
          messenger.showSnackBar(
            SnackBar(
              content: Text(
                response['message'] as String? ?? 'Test transaction created.',
              ),
            ),
          );
          return;
        }
        final url = response['url'];
        final fields = response['fields'];
        if (response['sandbox'] != true ||
            url != 'https://sandbox.payfast.co.za/eng/process' ||
            fields is! Map) {
          throw ApiException(502, 'Unexpected test checkout response.');
        }
        await navigator.push(
          MaterialPageRoute<void>(
            builder: (_) => PayFastCheckoutScreen(
              fields: Map<String, dynamic>.from(fields),
            ),
          ),
        );
        await AppState().loadOrders();
        return;
      }
      if (action == 'escrow-refresh-test') {
        await AppState().loadOrders();
      }
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            response['message'] as String? ?? 'Test order updated.',
          ),
        ),
      );
    } on ApiException catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  void _rate(BuildContext context, EscrowOrder order) {
    var stars = 0;
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text('Rate ${order.item.sellerName}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'How was buying "${order.item.title}"?',
                style: TextStyle(color: DobhaColors.textSecondary),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 1; i <= 5; i++)
                    IconButton(
                      tooltip: '$i star${i == 1 ? '' : 's'}',
                      iconSize: 34,
                      onPressed: () => setState(() => stars = i),
                      icon: Icon(
                        i <= stars
                            ? Icons.star_rounded
                            : Icons.star_outline_rounded,
                        color: i <= stars
                            ? DobhaColors.green
                            : DobhaColors.muted,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                controller: ctrl,
                maxLength: 300,
                maxLines: 3,
                minLines: 1,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  hintText:
                      'Say something about the piece or seller (optional)',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Later'),
            ),
            FilledButton(
              onPressed: stars == 0
                  ? null
                  : () {
                      Navigator.of(ctx).pop();
                      _act(
                        context,
                        () => AppState().reviewOrder(
                          order.id,
                          stars,
                          ctrl.text.trim(),
                        ),
                        'Thanks for rating',
                      );
                    },
              child: const Text('Send'),
            ),
          ],
        ),
      ),
    );
  }
}
