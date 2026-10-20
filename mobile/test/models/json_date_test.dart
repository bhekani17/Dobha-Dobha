import 'package:flutter_test/flutter_test.dart';
import 'package:dobha_live/models/json_date.dart';
import 'package:dobha_live/models/user_profile.dart';

void main() {
  group('parseJsonDateTime', () {
    test('parses Unix millisecond timestamps returned by the API', () {
      expect(
        parseJsonDateTime(1792459881420),
        DateTime.fromMillisecondsSinceEpoch(1792459881420),
      );
    });

    test('preserves ISO-8601 timestamp support', () {
      expect(
        parseJsonDateTime('2026-10-20T01:31:21.420Z'),
        DateTime.utc(2026, 10, 20, 1, 31, 21, 420),
      );
    });

    test('rejects unsupported timestamp values', () {
      expect(() => parseJsonDateTime(null), throwsFormatException);
    });
  });

  test('UserProfile parses numeric createdAt values from the API', () {
    final createdAt = DateTime.fromMillisecondsSinceEpoch(1792459881420);
    final user = UserProfile.fromJson({
      'id': 'user-1',
      'name': 'Test User',
      'email': 'test@example.com',
      'handle': 'test_user',
      'role': 'buyer',
      'createdAt': createdAt.millisecondsSinceEpoch,
    });

    expect(user.createdAt, createdAt);
  });
}
