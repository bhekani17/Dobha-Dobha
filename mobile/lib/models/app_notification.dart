/// Something that happened to the user's orders or listings (a sale, a dispatch, a payout...).
class AppNotification {
  final String id;
  final String kind;
  final String title;
  final String body;
  final String? orderId;
  final String? itemId;
  final bool read;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.kind,
    required this.title,
    required this.body,
    this.orderId,
    this.itemId,
    required this.read,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: json['id'] as String,
        kind: json['kind'] as String,
        title: json['title'] as String,
        body: json['body'] as String? ?? '',
        orderId: json['orderId'] as String?,
        itemId: json['itemId'] as String?,
        read: json['read'] as bool? ?? false,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
