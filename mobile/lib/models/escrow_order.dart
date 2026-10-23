import 'thrift_item.dart';

import 'json_date.dart';

enum EscrowStatus {
  paymentHeld, // Buyer paid; money locked in the Dobha escrow vault
  vendorDispatched, // Vendor shipped or dropped off at the locker/hub
  payoutReleased, // Buyer confirmed "Received as Shown"; vendor paid
  disputed, // Buyer reported a problem; funds frozen for support
  refunded, // Dispute settled for the buyer; money back in their wallet
  sellerApprovalPending,
  sellerAccepted,
  sandboxPaymentVerified,
  preparingTest,
  readyForCollectionTest,
  readyForCourierTest,
  inTransitTest,
  deliveryReportedTest,
  buyerConfirmedTest,
  sellerDeclined,
  cancelled,
  escrowSandboxTransactionCreated,
}

extension EscrowStatusX on EscrowStatus {
  /// Short status for the order card, from the viewer's side.
  String label({required bool isSeller}) {
    switch (this) {
      case EscrowStatus.paymentHeld:
        return isSeller ? 'Send it' : 'Paid';
      case EscrowStatus.vendorDispatched:
        return 'On its way';
      case EscrowStatus.payoutReleased:
        return 'Done';
      case EscrowStatus.disputed:
        return 'Problem reported';
      case EscrowStatus.refunded:
        return 'Refunded';
      case EscrowStatus.sellerApprovalPending:
        return 'Awaiting seller';
      case EscrowStatus.sellerAccepted:
        return 'Seller accepted';
      case EscrowStatus.sandboxPaymentVerified:
        return 'Test payment complete';
      case EscrowStatus.preparingTest:
        return 'Preparing (test)';
      case EscrowStatus.readyForCollectionTest:
        return 'Ready for pickup (test)';
      case EscrowStatus.readyForCourierTest:
        return 'Ready for courier (test)';
      case EscrowStatus.inTransitTest:
        return 'In transit (test)';
      case EscrowStatus.deliveryReportedTest:
        return 'Handoff reported (test)';
      case EscrowStatus.buyerConfirmedTest:
        return 'Completed (test)';
      case EscrowStatus.sellerDeclined:
        return 'Declined';
      case EscrowStatus.cancelled:
        return 'Cancelled';
      case EscrowStatus.escrowSandboxTransactionCreated:
        return 'Test transaction created';
    }
  }

  /// One sentence on what happens next.
  String description() {
    switch (this) {
      case EscrowStatus.paymentHeld:
        return 'Legacy order record. No payment is verified, and order fulfillment is currently unavailable.';
      case EscrowStatus.vendorDispatched:
        return 'Legacy order record. The displayed delivery status is not verified by a live payment or shipping service.';
      case EscrowStatus.payoutReleased:
        return 'Legacy order record. This status does not verify that any real payment or payout occurred.';
      case EscrowStatus.disputed:
        return 'Legacy order record. No money is held by Dobha; contact support if you need help with this record.';
      case EscrowStatus.refunded:
        return 'Legacy order record. This status does not verify that a real refund occurred.';
      case EscrowStatus.sellerApprovalPending:
        return 'Test order request sent. Waiting for the seller; no payment has been made.';
      case EscrowStatus.sellerAccepted:
        return 'Test order accepted. Continue to test checkout; no payment has been made.';
      case EscrowStatus.sandboxPaymentVerified:
        return 'Test status only. It does not verify real payment, delivery, or payout.';
      case EscrowStatus.preparingTest:
      case EscrowStatus.readyForCollectionTest:
      case EscrowStatus.readyForCourierTest:
      case EscrowStatus.inTransitTest:
      case EscrowStatus.deliveryReportedTest:
      case EscrowStatus.buyerConfirmedTest:
        return 'Test order only. Delivery updates are manual reports and do not verify delivery or cause a seller payout.';
      case EscrowStatus.sellerDeclined:
        return 'The seller declined this test order; no payment was made.';
      case EscrowStatus.cancelled:
        return 'This test order was cancelled; no payment or payout occurred.';
      case EscrowStatus.escrowSandboxTransactionCreated:
        return 'Test transaction only. Dobha does not verify real payment or release funds.';
    }
  }

  int get stepIndex {
    switch (this) {
      case EscrowStatus.paymentHeld:
        return 0;
      case EscrowStatus.vendorDispatched:
        return 1;
      case EscrowStatus.payoutReleased:
        return 3;
      case EscrowStatus.disputed:
      case EscrowStatus.refunded:
      case EscrowStatus.sellerApprovalPending:
      case EscrowStatus.sellerAccepted:
      case EscrowStatus.sandboxPaymentVerified:
      case EscrowStatus.preparingTest:
      case EscrowStatus.readyForCollectionTest:
      case EscrowStatus.readyForCourierTest:
      case EscrowStatus.inTransitTest:
      case EscrowStatus.deliveryReportedTest:
      case EscrowStatus.buyerConfirmedTest:
      case EscrowStatus.sellerDeclined:
      case EscrowStatus.cancelled:
      case EscrowStatus.escrowSandboxTransactionCreated:
        return -1;
    }
  }
}

class EscrowOrder {
  final String id;
  final ThriftItem item;
  final double amountZar;
  final double shippingFeeZar;
  final EscrowStatus status;
  final String deliveryMethod;
  final String deliveryAddress;
  final String paymentMethod;
  final DateTime createdAt;
  final DateTime? dispatchedAt;
  final DateTime? confirmedAt;
  final String escrowVaultRef;
  final String trackingNumber;
  final String buyerName;

  /// True when the signed-in user is the vendor on this order.
  final bool isSeller;
  final bool sandbox;
  final String paymentStatus;
  final String? providerTransactionId;

  /// The buyer's star rating (1-5) once they have left one.
  final int? reviewRating;

  /// The buyer can rate the seller now (order done, not rated yet).
  final bool canReview;

  const EscrowOrder({
    required this.id,
    required this.item,
    required this.amountZar,
    required this.shippingFeeZar,
    required this.status,
    required this.deliveryMethod,
    required this.deliveryAddress,
    required this.paymentMethod,
    required this.createdAt,
    this.dispatchedAt,
    this.confirmedAt,
    required this.escrowVaultRef,
    required this.trackingNumber,
    required this.buyerName,
    required this.isSeller,
    this.sandbox = false,
    this.paymentStatus = 'legacy_unverified',
    this.providerTransactionId,
    this.reviewRating,
    this.canReview = false,
  });

  double get totalZar => amountZar + shippingFeeZar;

  /// Collected at the Safe Hub instead of sent with a courier; no tracking number needed.
  bool get isHubCollection => deliveryMethod == 'Downtown Joburg Safe Hub';

  factory EscrowOrder.fromJson(Map<String, dynamic> json) {
    DateTime? date(String key) => parseNullableJsonDateTime(json[key]);
    double money(String key) {
      final value = json[key];
      if (value is num) return value.toDouble();
      if (value is String) {
        final parsed = double.tryParse(
          value.replaceAll(RegExp(r'[^0-9,.-]'), '').replaceAll(',', ''),
        );
        if (parsed != null) return parsed;
      }
      throw FormatException('Order is missing a valid $key value');
    }

    final itemJson = Map<String, dynamic>.from(
      json['item'] as Map<String, dynamic>,
    );
    final sellerId = json['sellerId'] as String? ?? 'unknown-seller';
    itemJson.putIfAbsent('sellerId', () => sellerId);
    itemJson.putIfAbsent('sellerHandle', () => sellerId);
    itemJson.putIfAbsent('sellerName', () => 'Vendor');
    itemJson.putIfAbsent('priceZar', () => json['amountZar']);
    itemJson.putIfAbsent('createdAt', () => json['createdAt']);
    return EscrowOrder(
      id: json['id'] as String,
      item: ThriftItem.fromJson(itemJson),
      amountZar: money('amountZar'),
      shippingFeeZar: money('shippingFeeZar'),
      status: EscrowStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => EscrowStatus.paymentHeld,
      ),
      deliveryMethod: json['deliveryMethod'] as String,
      deliveryAddress: json['deliveryAddress'] as String? ?? '',
      paymentMethod: json['paymentMethod'] as String? ?? 'unknown',
      createdAt: parseJsonDateTime(json['createdAt']),
      dispatchedAt: date('dispatchedAt'),
      confirmedAt: date('confirmedAt'),
      escrowVaultRef: json['escrowVaultRef'] as String? ?? '',
      trackingNumber: json['trackingNumber'] as String? ?? '',
      buyerName: json['buyerName'] as String? ?? '',
      isSeller: json['isSeller'] as bool? ?? false,
      sandbox: json['sandbox'] as bool? ?? false,
      paymentStatus: json['paymentStatus'] as String? ?? 'legacy_unverified',
      providerTransactionId: json['providerTransactionId'] as String?,
      reviewRating:
          (json['review'] as Map<String, dynamic>?)?['rating'] as int?,
      canReview: json['canReview'] as bool? ?? false,
    );
  }
}
