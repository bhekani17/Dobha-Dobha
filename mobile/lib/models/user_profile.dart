enum UserRole {
  shopper,
  vendor,
}

enum TransactionType {
  escrowHold,
  escrowRelease,
  withdrawal,
  topup,
}

class WalletTransaction {
  final String id;
  final String title;
  final String subtitle;
  final double amountZar;
  final TransactionType type;
  final DateTime date;
  final String status;
  final String reference;

  const WalletTransaction({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.amountZar,
    required this.type,
    required this.date,
    required this.status,
    required this.reference,
  });

  bool get isCredit => type == TransactionType.escrowRelease || type == TransactionType.topup;

  factory WalletTransaction.fromJson(Map<String, dynamic> json) => WalletTransaction(
        id: json['id'] as String,
        title: json['title'] as String,
        subtitle: json['subtitle'] as String? ?? '',
        amountZar: (json['amountZar'] as num).toDouble(),
        type: TransactionType.values.firstWhere((t) => t.name == json['type'], orElse: () => TransactionType.topup),
        date: DateTime.parse(json['date'] as String),
        status: json['status'] as String? ?? '',
        reference: json['reference'] as String? ?? '',
      );
}

class UserProfile {
  final String id;
  final String email;
  final String name;
  final String handle;
  final String phone;
  final UserRole role;
  final String shopName;
  final String stallLocation;
  final String? avatarUrl;
  final String bio;
  final String location;
  final DateTime createdAt;
  final int salesCount;

  const UserProfile({
    required this.id,
    required this.email,
    required this.name,
    required this.handle,
    required this.phone,
    required this.role,
    required this.shopName,
    required this.stallLocation,
    this.avatarUrl,
    this.bio = '',
    this.location = '',
    required this.createdAt,
    this.salesCount = 0,
  });

  bool get isVendor => role == UserRole.vendor;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, parts.first.length.clamp(1, 2)).toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        id: json['id'] as String,
        email: json['email'] as String? ?? '',
        name: json['name'] as String,
        handle: json['handle'] as String,
        phone: json['phone'] as String? ?? '',
        role: json['role'] == 'vendor' ? UserRole.vendor : UserRole.shopper,
        shopName: json['shopName'] as String? ?? '',
        stallLocation: json['stallLocation'] as String? ?? '',
        avatarUrl: json['avatarUrl'] as String?,
        bio: json['bio'] as String? ?? '',
        location: json['location'] as String? ?? '',
        createdAt: DateTime.parse(json['createdAt'] as String),
        salesCount: json['salesCount'] as int? ?? 0,
      );
}
