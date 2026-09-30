class ThriftItem {
  final String id;
  final String title;
  final double priceZar;
  final double? originalPriceZar;
  final String condition; // e.g. "Grade A Vintage", "90s Deadstock", "Lightly Worn", "Distressed Gem"
  final String size; // e.g. "M", "L", "XL", "32W"
  final String category; // e.g. "Jackets", "Denim", "Sneakers", "Workwear", "Vintage Tees", "Knitwear"
  final String sellerId;
  final String sellerName;
  final String sellerHandle;
  final String sellerLocation; // e.g. "Small Street Mall, Downtown JHB", "Braamfontein Alley"
  final String sellerBadge; // e.g. "Bale Boss 👑", "Top Curator ✨", "Vintage Plug 🔌"
  final String description;
  final List<String> tags;
  final int likesCount;
  final int viewsCount;
  final bool isLiked;
  final bool isSaved;
  final bool isClaimed;
  final String? claimedBy;
  final List<String> gradientColorsHex; // For vibrant street aesthetic video reel preview
  final String haulCaption;
  final String conditionDetail;

  const ThriftItem({
    required this.id,
    required this.title,
    required this.priceZar,
    this.originalPriceZar,
    required this.condition,
    required this.size,
    required this.category,
    required this.sellerId,
    required this.sellerName,
    required this.sellerHandle,
    required this.sellerLocation,
    required this.sellerBadge,
    required this.description,
    this.tags = const [],
    this.likesCount = 0,
    this.viewsCount = 0,
    this.isLiked = false,
    this.isSaved = false,
    this.isClaimed = false,
    this.claimedBy,
    this.gradientColorsHex = const ['#1F1C2C', '#928DAB'],
    this.haulCaption = '',
    this.conditionDetail = 'Handpicked & inspected for authentic vintage wear',
  });

  String get formattedPrice => 'R ${priceZar.toStringAsFixed(0)}';
  String get formattedOriginalPrice =>
      originalPriceZar != null ? 'R ${originalPriceZar!.toStringAsFixed(0)}' : '';

  ThriftItem copyWith({
    String? id,
    String? title,
    double? priceZar,
    double? originalPriceZar,
    String? condition,
    String? size,
    String? category,
    String? sellerId,
    String? sellerName,
    String? sellerHandle,
    String? sellerLocation,
    String? sellerBadge,
    String? description,
    List<String>? tags,
    int? likesCount,
    int? viewsCount,
    bool? isLiked,
    bool? isSaved,
    bool? isClaimed,
    String? claimedBy,
    List<String>? gradientColorsHex,
    String? haulCaption,
    String? conditionDetail,
  }) {
    return ThriftItem(
      id: id ?? this.id,
      title: title ?? this.title,
      priceZar: priceZar ?? this.priceZar,
      originalPriceZar: originalPriceZar ?? this.originalPriceZar,
      condition: condition ?? this.condition,
      size: size ?? this.size,
      category: category ?? this.category,
      sellerId: sellerId ?? this.sellerId,
      sellerName: sellerName ?? this.sellerName,
      sellerHandle: sellerHandle ?? this.sellerHandle,
      sellerLocation: sellerLocation ?? this.sellerLocation,
      sellerBadge: sellerBadge ?? this.sellerBadge,
      description: description ?? this.description,
      tags: tags ?? this.tags,
      likesCount: likesCount ?? this.likesCount,
      viewsCount: viewsCount ?? this.viewsCount,
      isLiked: isLiked ?? this.isLiked,
      isSaved: isSaved ?? this.isSaved,
      isClaimed: isClaimed ?? this.isClaimed,
      claimedBy: claimedBy ?? this.claimedBy,
      gradientColorsHex: gradientColorsHex ?? this.gradientColorsHex,
      haulCaption: haulCaption ?? this.haulCaption,
      conditionDetail: conditionDetail ?? this.conditionDetail,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'priceZar': priceZar,
        'originalPriceZar': originalPriceZar,
        'condition': condition,
        'size': size,
        'category': category,
        'sellerId': sellerId,
        'sellerName': sellerName,
        'sellerHandle': sellerHandle,
        'sellerLocation': sellerLocation,
        'sellerBadge': sellerBadge,
        'description': description,
        'tags': tags,
        'likesCount': likesCount,
        'viewsCount': viewsCount,
        'isLiked': isLiked,
        'isSaved': isSaved,
        'isClaimed': isClaimed,
        'claimedBy': claimedBy,
        'gradientColorsHex': gradientColorsHex,
        'haulCaption': haulCaption,
        'conditionDetail': conditionDetail,
      };

  factory ThriftItem.fromJson(Map<String, dynamic> json) => ThriftItem(
        id: json['id'] as String,
        title: json['title'] as String? ?? 'Vintage Piece',
        priceZar: (json['priceZar'] as num?)?.toDouble() ?? 100.0,
        originalPriceZar: (json['originalPriceZar'] as num?)?.toDouble(),
        condition: json['condition'] as String? ?? 'Grade A Vintage',
        size: json['size'] as String? ?? 'M',
        category: json['category'] as String? ?? 'Jackets',
        sellerId: json['sellerId'] as String? ?? 'vendor-1',
        sellerName: json['sellerName'] as String? ?? 'Dobha Vendor',
        sellerHandle: json['sellerHandle'] as String? ?? '@dobhavendor',
        sellerLocation: json['sellerLocation'] as String? ?? 'Downtown JHB',
        sellerBadge: json['sellerBadge'] as String? ?? 'Bale Boss 👑',
        description: json['description'] as String? ?? '',
        tags: (json['tags'] as List?)?.map((e) => e.toString()).toList() ?? [],
        likesCount: json['likesCount'] as int? ?? 0,
        viewsCount: json['viewsCount'] as int? ?? 0,
        isLiked: json['isLiked'] as bool? ?? false,
        isSaved: json['isSaved'] as bool? ?? false,
        isClaimed: json['isClaimed'] as bool? ?? false,
        claimedBy: json['claimedBy'] as String?,
        gradientColorsHex: (json['gradientColorsHex'] as List?)
                ?.map((e) => e.toString())
                .toList() ??
            const ['#1F1C2C', '#928DAB'],
        haulCaption: json['haulCaption'] as String? ?? '',
        conditionDetail: json['conditionDetail'] as String? ??
            'Handpicked & inspected for authentic vintage wear',
      );
}
