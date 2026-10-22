import 'package:dobha_live/models/social.dart';
import 'package:dobha_live/models/thrift_item.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses server comment records using snake-case fields', () {
    final comment = ItemComment.fromJson({
      'id': 'comment-1',
      'item_id': 'item-1',
      'user_id': 'user-1',
      'user_name': 'Seller Shop',
      'user_handle': 'seller_shop',
      'text': 'Still available?',
      'created_at': '2026-10-20T10:30:00.000Z',
    });

    expect(comment.userId, 'user-1');
    expect(comment.name, 'Seller Shop');
    expect(comment.handle, 'seller_shop');
    expect(comment.text, 'Still available?');
  });

  test('parses the server chat list response shape', () {
    final chat = ChatSummary.fromJson({
      'id': 'seller-1',
      'peer': {
        'id': 'seller-1',
        'name': 'Seller Shop',
        'handle': 'seller_shop',
      },
      'lastMessage': 'Yes, available',
      'lastMessageAt': '2026-10-20T10:30:00.000Z',
    });

    expect(chat.userId, 'seller-1');
    expect(chat.name, 'Seller Shop');
    expect(chat.handle, 'seller_shop');
    expect(chat.lastMessage, 'Yes, available');
  });

  test('parses the server chat message response shape', () {
    final message = ChatMessage.fromJson({
      'id': 'message-1',
      'text': 'Can I see another photo?',
      'isMe': true,
      'createdAt': '2026-10-20T10:30:00.000Z',
    });

    expect(message.fromMe, isTrue);
    expect(message.text, 'Can I see another photo?');
  });
}
