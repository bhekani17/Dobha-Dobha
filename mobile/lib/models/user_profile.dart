enum UserRole {
  shopper,
  vendor,
}

enum TransactionType {
  escrowDeposit,
  escrowRelease,
  escrowHold,
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
  final String status; // "Secured in Escrow", "Released to Vendor", "Completed"
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

  bool get isCredit =>
      type == TransactionType.escrowRelease ||
      type == TransactionType.topup;
}

class UserProfile {
  final String id;
  final String name;
  final String phone;
  final String handle;
  final UserRole role;
  final String avatarInitials;
  final String location;
  
  // Vendor-specific fields
  final String vendorShopName;
  final String vendorStallLocation;
  final String vendorBadge;
  final double rating;
  final int totalSalesCount;
  final double totalSalesZar;
  final bool isVerifiedVendor;

  const UserProfile({
    required this.id,
    required this.name,
    required this.phone,
    required this.handle,
    required this.role,
    this.avatarInitials = 'DB',
    this.location = 'Johannesburg, GP',
    this.vendorShopName = 'Bale Vault Downtown',
    this.vendorStallLocation = 'Small Street Mall, Unit 4B, Joburg CBD',
    this.vendorBadge = 'Bale Boss 👑',
    this.rating = 4.9,
    this.totalSalesCount = 86,
    this.totalSalesZar = 34500.0,
    this.isVerifiedVendor = true,
  });

  UserProfile copyWith({
    String? id,
    String? name,
    String? phone,
    String? handle,
    UserRole? role,
    String? avatarInitials,
    String? location,
    String? vendorShopName,
    String? vendorStallLocation,
    String? vendorBadge,
    double? rating,
    int? totalSalesCount,
    double? totalSalesZar,
    bool? isVerifiedVendor,
  }) {
    return UserProfile(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      handle: handle ?? this.handle,
      role: role ?? this.role,
      avatarInitials: avatarInitials ?? this.avatarInitials,
      location: location ?? this.location,
      vendorShopName: vendorShopName ?? this.vendorShopName,
      vendorStallLocation: vendorStallLocation ?? this.vendorStallLocation,
      vendorBadge: vendorBadge ?? this.vendorBadge,
      rating: rating ?? this.rating,
      totalSalesCount: totalSalesCount ?? this.totalSalesCount,
      totalSalesZar: totalSalesZar ?? this.totalSalesZar,
      isVerifiedVendor: isVerifiedVendor ?? this.isVerifiedVendor,
    );
  }
}
