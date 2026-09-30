import 'thrift_item.dart';

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

/// A listing other users reported, as admins see it.
class ReportedItem {
  final ThriftItem item;
  final int reports;
  final List<String> reasons;

  const ReportedItem(this.item, this.reports, this.reasons);

  factory ReportedItem.fromJson(Map<String, dynamic> json) => ReportedItem(
        ThriftItem.fromJson(json),
        json['reports'] as int? ?? 0,
        (json['reportReasons'] as List? ?? const []).cast<String>(),
      );
}
