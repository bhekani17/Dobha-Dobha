import 'package:flutter_test/flutter_test.dart';
import 'package:dobha_live/models/escrow_order.dart';

void main() {
  test('parses a sandbox order returned by the API', () {
    final order = EscrowOrder.fromJson({
      'id': 'ord_test',
      'itemId': 'itm_test',
      'amountZar': 'R 1600.00',
      'shippingFeeZar': 'R 0.00',
      'status': 'sellerApprovalPending',
      'deliveryMethod': 'Seller pickup (manual test)',
      'deliveryAddress': 'Test pickup location',
      'paymentMethod': 'payfast_sandbox',
      'paymentStatus': 'not_started',
      'sandbox': true,
      'buyerId': 'usr_buyer',
      'sellerId': 'usr_seller',
      'isSeller': false,
      'createdAt': '2026-10-23T00:00:00.000Z',
      'trackingNumber': '',
      'item': {'id': 'itm_test', 'title': 'Test listing', 'photos': <String>[]},
    });

    expect(order.sandbox, isTrue);
    expect(order.status, EscrowStatus.sellerApprovalPending);
    expect(order.paymentStatus, 'not_started');
    expect(order.amountZar, 1600);
    expect(order.item.sellerId, 'usr_seller');
    expect(order.item.priceZar, 1600);
    expect(order.status.description(), contains('no payment has been made'));
  });
}
