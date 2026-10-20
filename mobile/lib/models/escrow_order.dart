import 'thrift_item.dart';

import 'json_date.dart';

enum EscrowStatus {
  paymentHeld, // Buyer paid; money locked in the Dobha escrow vault
  vendorDispatched, // Vendor shipped or dropped off at the locker/hub
  payoutReleased, // Buyer confirmed "Received as Shown"; vendor paid
  disputed, // Buyer reported a problem; funds frozen for support
  refunded, // Dispute settled for the buyer; money back in their wallet
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
    this.reviewRating,
    this.canReview = false,
  });

  double get totalZar => amountZar + shippingFeeZar;

  /// Collected at the Safe Hub instead of sent with a courier; no tracking number needed.
  bool get isHubCollection => deliveryMethod == 'Downtown Joburg Safe Hub';

  factory EscrowOrder.fromJson(Map<String, dynamic> json) {
    DateTime? date(String key) => parseNullableJsonDateTime(json[key]);
    return EscrowOrder(
      id: json['id'] as String,
      item: ThriftItem.fromJson(json['item'] as Map<String, dynamic>),
      amountZar: (json['amountZar'] as num).toDouble(),
      shippingFeeZar: (json['shippingFeeZar'] as num).toDouble(),
      status: EscrowStatus.values.firstWhere((s) => s.name == json['status'], orElse: () => EscrowStatus.paymentHeld),
      deliveryMethod: json['deliveryMethod'] as String,
      deliveryAddress: json['deliveryAddress'] as String,
      paymentMethod: json['paymentMethod'] as String,
      createdAt: parseJsonDateTime(json['createdAt']),
      dispatchedAt: date('dispatchedAt'),
      confirmedAt: date('confirmedAt'),
      escrowVaultRef: json['escrowVaultRef'] as String,
      trackingNumber: json['trackingNumber'] as String,
      buyerName: json['buyerName'] as String? ?? '',
      isSeller: json['isSeller'] as bool? ?? false,
      reviewRating: (json['review'] as Map<String, dynamic>?)?['rating'] as int?,
      canReview: json['canReview'] as bool? ?? false,
    );
  }
}
