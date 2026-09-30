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
  static const categories = ['Jackets', 'Denim', 'Sneakers', 'Workwear', 'Vintage Tees', 'Knitwear', 'Other'];
  static const conditions = ['Grade A Vintage', '90s Deadstock', 'Lightly Worn', 'Distressed Classic'];
  static const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'Free Size'];

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
  final int likesCount;
  final int commentsCount;
  final bool isLiked;
  final bool isSaved;
  final bool isClaimed;
  final DateTime createdAt;

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
    this.likesCount = 0,
    this.commentsCount = 0,
    this.isLiked = false,
    this.isSaved = false,
    this.isClaimed = false,
    required this.createdAt,
  });

  String get formattedPrice => 'R ${priceZar.toStringAsFixed(0)}';
  String get formattedOriginalPrice => originalPriceZar != null ? 'R ${originalPriceZar!.toStringAsFixed(0)}' : '';

  factory ThriftItem.fromJson(Map<String, dynamic> json) => ThriftItem(
        id: json['id'] as String,
        title: json['title'] as String,
        description: json['description'] as String? ?? '',
        haulCaption: json['haulCaption'] as String? ?? '',
        priceZar: (json['priceZar'] as num).toDouble(),
        originalPriceZar: (json['originalPriceZar'] as num?)?.toDouble(),
        condition: json['condition'] as String,
        size: json['size'] as String,
        category: json['category'] as String,
        photoUrl: json['photoUrl'] as String?,
        media: [for (final m in json['media'] as List? ?? const []) ItemMedia.fromJson(m as Map<String, dynamic>)],
        sellerId: json['sellerId'] as String,
        sellerName: json['sellerName'] as String,
        sellerHandle: json['sellerHandle'] as String,
        sellerLocation: json['sellerLocation'] as String? ?? '',
        likesCount: json['likesCount'] as int? ?? 0,
        commentsCount: json['commentsCount'] as int? ?? 0,
        isLiked: json['isLiked'] as bool? ?? false,
        isSaved: json['isSaved'] as bool? ?? false,
        isClaimed: json['isClaimed'] as bool? ?? false,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class ItemComment {
  final String id;
  final String text;
  final String name;
  final String handle;
  final DateTime createdAt;

  const ItemComment({required this.id, required this.text, required this.name, required this.handle, required this.createdAt});

  factory ItemComment.fromJson(Map<String, dynamic> json) => ItemComment(
        id: json['id'] as String,
        text: json['text'] as String,
        name: json['name'] as String,
        handle: json['handle'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
