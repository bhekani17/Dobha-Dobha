import 'package:flutter_test/flutter_test.dart';

import 'package:dobha_live/models/app_notification.dart';

void main() {
  test(
    'copyWith can mark a notification as read without changing its data',
    () {
      final createdAt = DateTime.utc(2026, 10, 23);
      final notification = AppNotification(
        id: 'notification-1',
        kind: 'sale',
        title: 'A sale was made',
        body: 'Your item sold.',
        orderId: 'order-1',
        itemId: 'item-1',
        read: false,
        createdAt: createdAt,
      );

      final read = notification.copyWith(read: true);

      expect(read.read, isTrue);
      expect(read.id, notification.id);
      expect(read.kind, notification.kind);
      expect(read.title, notification.title);
      expect(read.body, notification.body);
      expect(read.orderId, notification.orderId);
      expect(read.itemId, notification.itemId);
      expect(read.createdAt, createdAt);
    },
  );
}
