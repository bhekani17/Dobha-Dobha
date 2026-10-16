import 'thrift_item.dart';

/// A price offer on a listing, seen by either the buyer or the seller.
class Offer {
  final String id;
  final ThriftItem item;
  final bool itemAvailable;
  final double amountZar;

  /// pending, countered, accepted, declined, cancelled, used or expired.
  final String status;
  final bool isSeller;
  final String buyerName;
  final DateTime? expiresAt;
  final DateTime updatedAt;

  const Offer({
    required this.id,
    required this.item,
    required this.itemAvailable,
    required this.amountZar,
    required this.status,
    required this.isSeller,
    required this.buyerName,
    this.expiresAt,
    required this.updatedAt,
  });

  String get formattedAmount => 'R ${amountZar.toStringAsFixed(0)}';

  /// Still needs someone to do something (answer it, or buy at the agreed price).
  bool get isOpen => itemAvailable && (status == 'pending' || status == 'countered' || status == 'accepted');

  factory Offer.fromJson(Map<String, dynamic> json) => Offer(
        id: json['id'] as String,
        item: ThriftItem.fromJson(json['item'] as Map<String, dynamic>),
        itemAvailable: json['itemAvailable'] as bool? ?? false,
        amountZar: (json['amountZar'] as num).toDouble(),
        status: json['status'] as String,
        isSeller: json['isSeller'] as bool? ?? false,
        buyerName: json['buyerName'] as String? ?? '',
        expiresAt: json['expiresAt'] == null ? null : DateTime.parse(json['expiresAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
      );
}

/// A seller's public page.
class SellerProfile {
  final String id;
  final String name;
  final String handle;
  final String shopName;
  final String stallLocation;
  final String? avatarUrl;
  final String bio;
  final bool isVendor;
  final DateTime createdAt;
  final int salesCount;
  final double? rating;
  final int reviewCount;
  final int followerCount;
  final int followingCount;
  final bool isFollowing;
  final bool followsYou;
  final bool isMe;

  const SellerProfile({
    required this.id,
    required this.name,
    required this.handle,
    required this.shopName,
    required this.stallLocation,
    this.avatarUrl,
    required this.bio,
    required this.isVendor,
    required this.createdAt,
    required this.salesCount,
    this.rating,
    required this.reviewCount,
    required this.followerCount,
    this.followingCount = 0,
    required this.isFollowing,
    this.followsYou = false,
    required this.isMe,
  });

  String get displayName => shopName.isNotEmpty ? shopName : name;

  factory SellerProfile.fromJson(Map<String, dynamic> json) => SellerProfile(
        id: json['id'] as String,
        name: json['name'] as String,
        handle: json['handle'] as String,
        shopName: json['shopName'] as String? ?? '',
        stallLocation: json['stallLocation'] as String? ?? '',
        avatarUrl: json['avatarUrl'] as String?,
        bio: json['bio'] as String? ?? '',
        isVendor: json['isVendor'] as bool? ?? false,
        createdAt: DateTime.parse(json['createdAt'] as String),
        salesCount: json['salesCount'] as int? ?? 0,
        rating: (json['rating'] as num?)?.toDouble(),
        reviewCount: json['reviewCount'] as int? ?? 0,
        followerCount: json['followerCount'] as int? ?? 0,
        followingCount: json['followingCount'] as int? ?? 0,
        isFollowing: json['isFollowing'] as bool? ?? false,
        followsYou: json['followsYou'] as bool? ?? false,
        isMe: json['isMe'] as bool? ?? false,
      );
}

/// Someone in a followers, following or people-search list.
class PersonRow {
  final String id;
  final String name;
  final String handle;
  final String? avatarUrl;
  final bool isVendor;
  final bool isFollowing;
  final bool followsYou;
  final bool isMe;

  const PersonRow({
    required this.id,
    required this.name,
    required this.handle,
    this.avatarUrl,
    required this.isVendor,
    required this.isFollowing,
    required this.followsYou,
    required this.isMe,
  });

  PersonRow copyWith({bool? isFollowing}) => PersonRow(
        id: id,
        name: name,
        handle: handle,
        avatarUrl: avatarUrl,
        isVendor: isVendor,
        isFollowing: isFollowing ?? this.isFollowing,
        followsYou: followsYou,
        isMe: isMe,
      );

  factory PersonRow.fromJson(Map<String, dynamic> json) => PersonRow(
        id: json['id'] as String,
        name: json['name'] as String,
        handle: json['handle'] as String,
        avatarUrl: json['avatarUrl'] as String?,
        isVendor: json['isVendor'] as bool? ?? false,
        isFollowing: json['isFollowing'] as bool? ?? false,
        followsYou: json['followsYou'] as bool? ?? false,
        isMe: json['isMe'] as bool? ?? false,
      );
}

class Review {
  final int rating;
  final String text;
  final String buyerName;
  final String itemTitle;
  final DateTime createdAt;

  const Review({required this.rating, required this.text, required this.buyerName, required this.itemTitle, required this.createdAt});

  factory Review.fromJson(Map<String, dynamic> json) => Review(
        rating: json['rating'] as int,
        text: json['text'] as String? ?? '',
        buyerName: json['buyerName'] as String? ?? '',
        itemTitle: json['itemTitle'] as String? ?? '',
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

/// One conversation in the chats list.
class ChatSummary {
  final String userId;
  final String name;
  final String handle;
  final String? avatarUrl;
  final String lastMessage;
  final bool lastFromMe;
  final int unread;
  final DateTime updatedAt;

  const ChatSummary({
    required this.userId,
    required this.name,
    required this.handle,
    this.avatarUrl,
    required this.lastMessage,
    required this.lastFromMe,
    required this.unread,
    required this.updatedAt,
  });

  factory ChatSummary.fromJson(Map<String, dynamic> json) => ChatSummary(
        userId: json['userId'] as String,
        name: json['name'] as String,
        handle: json['handle'] as String,
        avatarUrl: json['avatarUrl'] as String?,
        lastMessage: json['lastMessage'] as String? ?? '',
        lastFromMe: json['lastFromMe'] as bool? ?? false,
        unread: json['unread'] as int? ?? 0,
        updatedAt: DateTime.parse(json['updatedAt'] as String),
      );
}

/// A listing a chat message is about.
class ChatItemRef {
  final String id;
  final String title;
  final double? priceZar;
  final String? photoUrl;
  const ChatItemRef({required this.id, required this.title, this.priceZar, this.photoUrl});
}

class ChatMessage {
  final String id;
  final String text;
  final bool fromMe;
  final DateTime createdAt;
  final ChatItemRef? item;

  const ChatMessage({required this.id, required this.text, required this.fromMe, required this.createdAt, this.item});

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final item = json['item'] as Map<String, dynamic>?;
    return ChatMessage(
      id: json['id'] as String,
      text: json['text'] as String,
      fromMe: json['fromMe'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      item: item == null
          ? null
          : ChatItemRef(
              id: item['id'] as String,
              title: item['title'] as String? ?? '',
              priceZar: (item['priceZar'] as num?)?.toDouble(),
              photoUrl: item['photoUrl'] as String?,
            ),
    );
  }
}
