import 'package:dobha_live/models/thrift_item.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses listing feed responses from the server', () {
    final item = ThriftItem.fromJson({
      'id': 'item-1',
      'title': 'Vintage jacket',
      'description': 'A good everyday jacket',
      'priceCents': 20000,
      'priceZar': 'R 200.00',
      'photos': ['/media/jacket.jpg'],
      'category': 'Jackets',
      'condition': 'Good',
      'size': 'M',
      'status': 'available',
      'quantity': 1,
      'media': [
        {'kind': 'image', 'url': '/media/jacket.jpg'},
      ],
      'createdAt': '2026-10-21T22:23:32.631Z',
      'seller': {
        'id': 'seller-1',
        'name': 'Vintage Finds',
        'handle': 'vintage_finds',
        'shopName': 'Vintage Finds',
        'stallLocation': 'Soweto',
        'avatarUrl': '/media/seller.jpg',
      },
    });

    expect(item.id, 'item-1');
    expect(item.priceZar, 200);
    expect(item.photoUrl, '/media/jacket.jpg');
    expect(item.media, hasLength(1));
    expect(item.sellerId, 'seller-1');
    expect(item.sellerName, 'Vintage Finds');
    expect(item.sellerHandle, 'vintage_finds');
    expect(item.sellerLocation, 'Soweto');
    expect(item.sellerAvatarUrl, '/media/seller.jpg');
  });

  test('keeps support for the older flat listing response format', () {
    final item = ThriftItem.fromJson({
      'id': 'item-2',
      'title': 'Denim jeans',
      'priceZar': 350,
      'condition': 'Good',
      'size': 'L',
      'category': 'Denim',
      'sellerId': 'seller-2',
      'sellerName': 'Denim Shop',
      'sellerHandle': 'denim_shop',
      'createdAt': '2026-10-21T22:23:32.631Z',
    });

    expect(item.priceZar, 350);
    expect(item.sellerName, 'Denim Shop');
  });
}
