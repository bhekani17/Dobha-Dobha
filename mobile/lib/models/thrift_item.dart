import 'json_date.dart';

enum MediaKind { image, video }

/// One photo or video in a listing's gallery.
class ItemMedia {
  final MediaKind kind;
  final String url;
  const ItemMedia(this.kind, this.url);

  bool get isVideo => kind == MediaKind.video;

  factory ItemMedia.fromJson(Map<String, dynamic> json) =>
      ItemMedia(json['kind'] == 'video' ? MediaKind.video : MediaKind.image, json['url'] as String);
}

class ThriftItem {
  static const categories = [
    'Jackets',
    'Denim',
    'Sneakers',
    'Workwear',
    'Vintage Tees',
    'Knitwear',
    'Clothing & Accessories',
    'Shoes',
    'Electronics',
    'Home & Living',
    'Books & Media',
    'Sports & Outdoors',
    'Toys & Games',
    'Beauty & Personal Care',
    'Collectibles',
    'Other',
  ];
  static const conditions = [
    'New',
    'Like new',
    'Good',
    'Fair',
    'Needs repair',
    'Grade A Vintage',
    '90s Deadstock',
    'Lightly Worn',
    'Distressed Classic',
  ];
  static const sizes = ['N/A', 'One size', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'Free Size'];

  final String id;
  final String title;
  final String description;
  final String haulCaption;
  final double priceZar;
  final double? originalPriceZar;
  final String condition;
  final String size;
  final String category;
  final String? photoUrl;
  final List<ItemMedia> media;
  final String sellerId;
  final String sellerName;
  final String sellerHandle;
  final String sellerLocation;
  final String? sellerAvatarUrl;
  final int likesCount;
  final int commentsCount;
  final bool isLiked;
  final bool isSaved;
  final bool isClaimed;

  /// How many the seller has left; 0 once sold out.
  final int quantity;
  final bool inCart;
  final double? sellerRating;
  final int sellerReviewCount;
  final DateTime createdAt;

  /// True when the listing is currently in a paid promotion window.
  final bool isPromoted;
  final DateTime? promotedUntil;

  const ThriftItem({
    required this.id,
    required this.title,
    required this.description,
    required this.haulCaption,
    required this.priceZar,
    this.originalPriceZar,
    required this.condition,
    required this.size,
    required this.category,
    this.photoUrl,
    this.media = const [],
    required this.sellerId,
    required this.sellerName,
    required this.sellerHandle,
    required this.sellerLocation,
    this.sellerAvatarUrl,
    this.likesCount = 0,
    this.commentsCount = 0,
    this.isLiked = false,
    this.isSaved = false,
    this.isClaimed = false,
    this.quantity = 1,
    this.inCart = false,
    this.sellerRating,
    this.sellerReviewCount = 0,
    required this.createdAt,
    this.isPromoted = false,
    this.promotedUntil,
  });

  String get formattedPrice => 'R ${priceZar.toStringAsFixed(0)}';

  /// "8 left" when the seller has more than one, otherwise empty.
  String get stockLabel => !isClaimed && quantity > 1 ? '$quantity left' : '';
  String get formattedOriginalPrice => originalPriceZar != null ? 'R ${originalPriceZar!.toStringAsFixed(0)}' : '';

  factory ThriftItem.fromJson(Map<String, dynamic> json) {
    final seller = json['seller'] is Map<String, dynamic> ? json['seller'] as Map<String, dynamic> : const {};
    final rawMedia = json['media'] as List? ??
        [
          for (final photo in json['photos'] as List? ?? const [])
            {'kind': 'image', 'url': photo},
          if (json['videoUrl'] is String) {'kind': 'video', 'url': json['videoUrl']},
        ];
    final media = [
      for (final entry in rawMedia)
        if (entry is Map<String, dynamic>) ItemMedia.fromJson(entry),
    ];
    final photos = json['photos'] as List? ?? const [];
    final firstPhoto = media.where((entry) => !entry.isVideo).firstOrNull?.url ??
        (photos.isNotEmpty && photos.first is String ? photos.first as String : null);
    final status = json['status'] as String? ?? 'available';
    final sellerId = json['sellerId'] as String? ?? json['seller_id'] as String? ?? seller['id'] as String?;
    final sellerName = json['sellerName'] as String? ??
        json['seller_name'] as String? ??
        seller['name'] as String? ??
        seller['shopName'] as String? ??
        'Vendor';
    final sellerHandle = json['sellerHandle'] as String? ?? json['seller_handle'] as String? ?? seller['handle'] as String?;
    final sellerLocation =
        json['sellerLocation'] as String? ?? json['seller_location'] as String? ?? seller['stallLocation'] as String? ?? '';

    if (sellerId == null || sellerHandle == null) {
      throw const FormatException('Listing is missing its seller details');
    }

    return ThriftItem(
        id: json['id'] as String,
        title: json['title'] as String,
        description: json['description'] as String? ?? '',
        haulCaption: json['haulCaption'] as String? ?? '',
        priceZar: _parsePrice(json),
        originalPriceZar: (json['originalPriceZar'] as num?)?.toDouble(),
        condition: json['condition'] as String? ?? 'Pre-loved',
        size: json['size'] as String? ?? 'One Size',
        category: json['category'] as String? ?? 'General',
        photoUrl: json['photoUrl'] as String? ?? firstPhoto,
        media: media,
        sellerId: sellerId,
        sellerName: sellerName,
        sellerHandle: sellerHandle,
        sellerLocation: sellerLocation,
        sellerAvatarUrl: json['sellerAvatarUrl'] as String? ?? seller['avatarUrl'] as String?,
        likesCount: json['likesCount'] as int? ?? 0,
        commentsCount: json['commentsCount'] as int? ?? 0,
        isLiked: json['isLiked'] as bool? ?? false,
        isSaved: json['isSaved'] as bool? ?? false,
        isClaimed: json['isClaimed'] as bool? ?? status != 'available',
        quantity: json['quantity'] as int? ?? 1,
        inCart: json['inCart'] as bool? ?? false,
        sellerRating: (json['sellerRating'] as num?)?.toDouble(),
        sellerReviewCount: json['sellerReviewCount'] as int? ?? 0,
        createdAt: parseJsonDateTime(json['createdAt']),
        isPromoted: json['isPromoted'] as bool? ?? false,
        promotedUntil: parseNullableJsonDateTime(json['promotedUntil']),
      );
  }

  static double _parsePrice(Map<String, dynamic> json) {
    final price = json['priceZar'];
    if (price is num) return price.toDouble();
    if (price is String) {
      final amount = double.tryParse(price.replaceAll(RegExp(r'[^0-9,.-]'), '').replaceAll(',', ''));
      if (amount != null) return amount;
    }
    final cents = json['priceCents'];
    if (cents is num) return cents / 100;
    throw const FormatException('Listing is missing a valid price');
  }

  /// The same item with some fields changed.
  ThriftItem copyWith({int? commentsCount, bool? inCart, bool? isPromoted, DateTime? promotedUntil}) => ThriftItem(
        id: id,
        title: title,
        description: description,
        haulCaption: haulCaption,
        priceZar: priceZar,
        originalPriceZar: originalPriceZar,
        condition: condition,
        size: size,
        category: category,
        photoUrl: photoUrl,
        media: media,
        sellerId: sellerId,
        sellerName: sellerName,
        sellerHandle: sellerHandle,
        sellerLocation: sellerLocation,
        sellerAvatarUrl: sellerAvatarUrl,
        likesCount: likesCount,
        commentsCount: commentsCount ?? this.commentsCount,
        isLiked: isLiked,
        isSaved: isSaved,
        isClaimed: isClaimed,
        quantity: quantity,
        inCart: inCart ?? this.inCart,
        sellerRating: sellerRating,
        sellerReviewCount: sellerReviewCount,
        createdAt: createdAt,
        isPromoted: isPromoted ?? this.isPromoted,
        promotedUntil: promotedUntil ?? this.promotedUntil,
      );
}

class ItemComment {
  final String id;
  final String text;
  final String? userId;
  final String name;
  final String handle;
  final DateTime createdAt;

  const ItemComment({required this.id, required this.text, this.userId, required this.name, required this.handle, required this.createdAt});

  factory ItemComment.fromJson(Map<String, dynamic> json) => ItemComment(
        id: json['id'] as String,
        text: json['text'] as String,
        userId: json['userId'] as String?,
        name: json['name'] as String,
        handle: json['handle'] as String,
        createdAt: parseJsonDateTime(json['createdAt']),
      );
}
