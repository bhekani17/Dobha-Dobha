import 'thrift_item.dart';

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
  String description({required bool isSeller}) {
    switch (this) {
      case EscrowStatus.paymentHeld:
        return isSeller
            ? 'The buyer has paid. Send the piece, then tap the button below. You get paid once they receive it.'
            : 'You paid. We hold the money until you have the piece, so you are covered. Waiting for the seller to send it.';
      case EscrowStatus.vendorDispatched:
        return isSeller
            ? 'On its way. You get paid as soon as the buyer confirms it arrived.'
            : 'On its way to you. Check it when it arrives, then confirm so the seller gets paid.';
      case EscrowStatus.payoutReleased:
        return isSeller ? 'The buyer received it and you have been paid.' : 'You received it and the seller has been paid.';
      case EscrowStatus.disputed:
        return 'Dobha support is looking into this. The money stays on hold until it is sorted out.';
      case EscrowStatus.refunded:
        return isSeller ? 'Dobha support refunded the buyer.' : 'Dobha support refunded you. The money is back in your wallet.';
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
    DateTime? date(String key) => json[key] == null ? null : DateTime.parse(json[key] as String);
    return EscrowOrder(
      id: json['id'] as String,
      item: ThriftItem.fromJson(json['item'] as Map<String, dynamic>),
      amountZar: (json['amountZar'] as num).toDouble(),
      shippingFeeZar: (json['shippingFeeZar'] as num).toDouble(),
      status: EscrowStatus.values.firstWhere((s) => s.name == json['status'], orElse: () => EscrowStatus.paymentHeld),
      deliveryMethod: json['deliveryMethod'] as String,
      deliveryAddress: json['deliveryAddress'] as String,
      paymentMethod: json['paymentMethod'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
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
