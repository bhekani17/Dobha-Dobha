DateTime parseJsonDateTime(Object? value) {
  if (value is num) return DateTime.fromMillisecondsSinceEpoch(value.round());

  if (value is String) {
    final parsed = DateTime.tryParse(value);
    if (parsed != null) return parsed;

    final milliseconds = int.tryParse(value);
    if (milliseconds != null)
      return DateTime.fromMillisecondsSinceEpoch(milliseconds);
  }

  throw FormatException(
    'Expected an ISO-8601 date or Unix timestamp, got $value',
  );
}

DateTime? parseNullableJsonDateTime(Object? value) =>
    value == null ? null : parseJsonDateTime(value);
