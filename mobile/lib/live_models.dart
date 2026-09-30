class PinnedItem {
  final String id;
  final String title;
  final String price;
  final String size;
  final String status; // 'available' or 'sold'
  final String? claimedBy;

  const PinnedItem({
    required this.id,
    required this.title,
    required this.price,
    required this.size,
    this.status = 'available',
    this.claimedBy,
  });

  bool get isSold => status == 'sold';

  PinnedItem copyWith({
    String? id,
    String? title,
    String? price,
    String? size,
    String? status,
    String? claimedBy,
  }) {
    return PinnedItem(
      id: id ?? this.id,
      title: title ?? this.title,
      price: price ?? this.price,
      size: size ?? this.size,
      status: status ?? this.status,
      claimedBy: claimedBy ?? this.claimedBy,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'price': price,
        'size': size,
        'status': status,
        if (claimedBy != null) 'claimedBy': claimedBy,
      };

  factory PinnedItem.fromJson(Map<String, dynamic> json) => PinnedItem(
        id: json['id'] as String? ?? DateTime.now().millisecondsSinceEpoch.toString(),
        title: json['title'] as String? ?? '',
        price: json['price'] as String? ?? '',
        size: json['size'] as String? ?? 'Free Size',
        status: json['status'] as String? ?? 'available',
        claimedBy: json['claimedBy'] as String?,
      );
}
