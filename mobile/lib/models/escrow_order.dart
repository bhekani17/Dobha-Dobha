import 'thrift_item.dart';

enum EscrowStatus {
  paymentHeld, // Buyer paid; money locked safely in Dobha In-App Escrow vault
  vendorDispatched, // Vendor packaged and shipped or dropped off at Downtown Locker/Hub
  receivedConfirmed, // Shopper inspected item and tapped "Received as Shown"
  payoutReleased, // Escrow automatically disbursed funds to vendor wallet
  disputed, // Buyer raised a condition mismatch
}

extension EscrowStatusX on EscrowStatus {
  String get label {
    switch (this) {
      case EscrowStatus.paymentHeld:
        return 'Funds in Escrow 🔒';
      case EscrowStatus.vendorDispatched:
        return 'Dispatched / In Transit 🚚';
      case EscrowStatus.receivedConfirmed:
        return 'Condition Confirmed ✨';
      case EscrowStatus.payoutReleased:
        return 'Vendor Paid 💰';
      case EscrowStatus.disputed:
        return 'Under Escrow Review ⚠️';
    }
  }

  String get description {
    switch (this) {
      case EscrowStatus.paymentHeld:
        return 'Payment is locked in Dobha Escrow. The vendor cannot touch these funds until you receive the piece.';
      case EscrowStatus.vendorDispatched:
        return 'Vendor dropped item off at locker/courier. Inspect condition on arrival before releasing funds.';
      case EscrowStatus.receivedConfirmed:
        return 'You verified the piece matches the live/video description! Releasing funds to vendor.';
      case EscrowStatus.payoutReleased:
        return 'Escrow vault released payment to the vendor. Transaction complete.';
      case EscrowStatus.disputed:
        return 'Escrow team is mediating. Funds remain frozen in escrow until resolved.';
    }
  }

  int get stepIndex {
    switch (this) {
      case EscrowStatus.paymentHeld:
        return 0;
      case EscrowStatus.vendorDispatched:
        return 1;
      case EscrowStatus.receivedConfirmed:
        return 2;
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
  final String deliveryMethod; // "PUDO Locker-to-Locker", "Courier Guy Door-to-Door", "Bree St / Downtown Hub Pickup"
  final String paymentMethod; // "Capitec Pay (Instant)", "Ozow Instant EFT", "Mastercard/Visa", "Dobha Wallet"
  final DateTime createdAt;
  final DateTime? dispatchedAt;
  final DateTime? confirmedAt;
  final String escrowVaultRef;
  final String trackingNumber;
  final String deliveryAddress;

  const EscrowOrder({
    required this.id,
    required this.item,
    required this.amountZar,
    this.shippingFeeZar = 50.0,
    required this.status,
    required this.deliveryMethod,
    required this.paymentMethod,
    required this.createdAt,
    this.dispatchedAt,
    this.confirmedAt,
    required this.escrowVaultRef,
    required this.trackingNumber,
    required this.deliveryAddress,
  });

  double get totalZar => amountZar + shippingFeeZar;

  EscrowOrder copyWith({
    String? id,
    ThriftItem? item,
    double? amountZar,
    double? shippingFeeZar,
    EscrowStatus? status,
    String? deliveryMethod,
    String? paymentMethod,
    DateTime? createdAt,
    DateTime? dispatchedAt,
    DateTime? confirmedAt,
    String? escrowVaultRef,
    String? trackingNumber,
    String? deliveryAddress,
  }) {
    return EscrowOrder(
      id: id ?? this.id,
      item: item ?? this.item,
      amountZar: amountZar ?? this.amountZar,
      shippingFeeZar: shippingFeeZar ?? this.shippingFeeZar,
      status: status ?? this.status,
      deliveryMethod: deliveryMethod ?? this.deliveryMethod,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      createdAt: createdAt ?? this.createdAt,
      dispatchedAt: dispatchedAt ?? this.dispatchedAt,
      confirmedAt: confirmedAt ?? this.confirmedAt,
      escrowVaultRef: escrowVaultRef ?? this.escrowVaultRef,
      trackingNumber: trackingNumber ?? this.trackingNumber,
      deliveryAddress: deliveryAddress ?? this.deliveryAddress,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'item': item.toJson(),
        'amountZar': amountZar,
        'shippingFeeZar': shippingFeeZar,
        'status': status.name,
        'deliveryMethod': deliveryMethod,
        'paymentMethod': paymentMethod,
        'createdAt': createdAt.toIso8601String(),
        'dispatchedAt': dispatchedAt?.toIso8601String(),
        'confirmedAt': confirmedAt?.toIso8601String(),
        'escrowVaultRef': escrowVaultRef,
        'trackingNumber': trackingNumber,
        'deliveryAddress': deliveryAddress,
      };

  factory EscrowOrder.fromJson(Map<String, dynamic> json) => EscrowOrder(
        id: json['id'] as String,
        item: ThriftItem.fromJson(json['item'] as Map<String, dynamic>),
        amountZar: (json['amountZar'] as num).toDouble(),
        shippingFeeZar: (json['shippingFeeZar'] as num?)?.toDouble() ?? 50.0,
        status: EscrowStatus.values.firstWhere(
          (s) => s.name == json['status'],
          orElse: () => EscrowStatus.paymentHeld,
        ),
        deliveryMethod: json['deliveryMethod'] as String? ?? 'PUDO Locker-to-Locker',
        paymentMethod: json['paymentMethod'] as String? ?? 'Capitec Pay (Instant)',
        createdAt: DateTime.parse(json['createdAt'] as String),
        dispatchedAt: json['dispatchedAt'] != null
            ? DateTime.parse(json['dispatchedAt'] as String)
            : null,
        confirmedAt: json['confirmedAt'] != null
            ? DateTime.parse(json['confirmedAt'] as String)
            : null,
        escrowVaultRef: json['escrowVaultRef'] as String? ?? 'ESC-VAULT-DEFAULT',
        trackingNumber: json['trackingNumber'] as String? ?? 'PUDO-ZA-10293',
        deliveryAddress: json['deliveryAddress'] as String? ?? 'Rosebank Mall PUDO Locker, JHB',
      );
}
