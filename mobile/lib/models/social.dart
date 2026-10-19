import 'thrift_item.dart';

/// A 24-hour story posted by a user or vendor.
class Story {
  final String id;
  final String userId;
  final String userName;
  final String userHandle;
  final String? userAvatarUrl;
  final String mediaUrl;

  /// 'image' or 'video'
  final String mediaType;
  final String caption;
  final DateTime createdAt;
  final DateTime expiresAt;

  const Story({
    required this.id,
    required this.userId,
    required this.userName,
    required this.userHandle,
    this.userAvatarUrl,
    required this.mediaUrl,
    required this.mediaType,
    required this.caption,
    required this.createdAt,
    required this.expiresAt,
  });

  bool get isVideo => mediaType == 'video';

  factory Story.fromJson(Map<String, dynamic> json) => Story(
        id: json['id'] as String,
        userId: json['userId'] as String? ?? json['user_id'] as String,
        userName: json['userName'] as String? ?? json['user_name'] as String? ?? '',
        userHandle: json['userHandle'] as String? ?? json['user_handle'] as String? ?? '',
        userAvatarUrl: json['userAvatarUrl'] as String? ?? json['avatar_url'] as String?,
        mediaUrl: json['mediaUrl'] as String? ?? json['media_url'] as String,
        mediaType: json['mediaType'] as String? ?? json['media_type'] as String? ?? 'image',
        caption: json['caption'] as String? ?? '',
        createdAt: DateTime.fromMillisecondsSinceEpoch(
          json['createdAt'] is int
              ? json['createdAt'] as int
              : json['created_at'] is int
                  ? json['created_at'] as int
                  : DateTime.parse(json['createdAt'] as String? ?? json['created_at'] as String).millisecondsSinceEpoch,
        ),
        expiresAt: DateTime.fromMillisecondsSinceEpoch(
          json['expiresAt'] is int
              ? json['expiresAt'] as int
              : json['expires_at'] is int
                  ? json['expires_at'] as int
                  : DateTime.parse(json['expiresAt'] as String? ?? json['expires_at'] as String).millisecondsSinceEpoch,
        ),
      );
}

/// A group of stories from one user (how they appear in the stories row).
class StoryGroup {
  final String userId;
  final String userName;
  final String? userAvatarUrl;
  final List<Story> stories;

  const StoryGroup({
    required this.userId,
    required this.userName,
    this.userAvatarUrl,
    required this.stories,
  });

  Story get latest => stories.last;
}

/// A subscription record (who the current user has subscribed to).
class Subscription {
  final String sellerId;
  final String sellerName;
  final String? sellerAvatarUrl;
  final DateTime createdAt;

  const Subscription({
    required this.sellerId,
    required this.sellerName,
    this.sellerAvatarUrl,
    required this.createdAt,
  });

  factory Subscription.fromJson(Map<String, dynamic> json) => Subscription(
        sellerId: json['seller_id'] as String? ?? json['sellerId'] as String,
        sellerName: json['sellerName'] as String? ?? json['seller_name'] as String? ?? '',
        sellerAvatarUrl: json['sellerAvatarUrl'] as String? ?? json['avatar_url'] as String?,
        createdAt: DateTime.fromMillisecondsSinceEpoch(
          json['created_at'] is int ? json['created_at'] as int : DateTime.now().millisecondsSinceEpoch,
        ),
      );
}

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
