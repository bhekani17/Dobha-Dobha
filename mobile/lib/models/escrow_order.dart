import 'thrift_item.dart';

enum EscrowStatus {
  paymentHeld, // Buyer paid; money locked in the Dobha escrow vault
  vendorDispatched, // Vendor shipped or dropped off at the locker/hub
  payoutReleased, // Buyer confirmed "Received as Shown"; vendor paid
  disputed, // Buyer reported a problem; funds frozen for support
}

extension EscrowStatusX on EscrowStatus {
  String get label {
    switch (this) {
      case EscrowStatus.paymentHeld:
        return 'Funds in Escrow';
      case EscrowStatus.vendorDispatched:
        return 'In Transit';
      case EscrowStatus.payoutReleased:
        return 'Completed';
      case EscrowStatus.disputed:
        return 'Under Review';
    }
  }

  String description({required bool isSeller}) {
    switch (this) {
      case EscrowStatus.paymentHeld:
        return isSeller
            ? 'The buyer has paid into escrow. Pack the piece and mark it as dispatched.'
            : 'Your payment is locked in Dobha Escrow. The vendor is paid only after you receive the piece.';
      case EscrowStatus.vendorDispatched:
        return isSeller
            ? 'On its way. You are paid as soon as the buyer confirms it arrived as shown.'
            : 'The vendor has sent your piece. Check it on arrival before releasing the funds.';
      case EscrowStatus.payoutReleased:
        return 'Confirmed as shown and the vendor has been paid.';
      case EscrowStatus.disputed:
        return 'Dobha support is reviewing this order. Funds stay frozen until it is resolved.';
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
  });

  double get totalZar => amountZar + shippingFeeZar;

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
    );
  }
}
