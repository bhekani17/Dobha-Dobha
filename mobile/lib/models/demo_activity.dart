class DemoOrder {
  final String id;
  final String itemTitle;
  final double amountZar;
  final String deliveryMethod;
  final String paymentMethod;
  final String status;
  final DateTime createdAt;

  const DemoOrder({
    required this.id,
    required this.itemTitle,
    required this.amountZar,
    required this.deliveryMethod,
    required this.paymentMethod,
    required this.status,
    required this.createdAt,
  });

  DemoOrder copyWith({String? status}) => DemoOrder(
    id: id,
    itemTitle: itemTitle,
    amountZar: amountZar,
    deliveryMethod: deliveryMethod,
    paymentMethod: paymentMethod,
    status: status ?? this.status,
    createdAt: createdAt,
  );
}
