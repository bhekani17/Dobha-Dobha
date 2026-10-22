import 'package:flutter_test/flutter_test.dart';

import 'package:dobha_live/models/user_profile.dart';
import 'package:dobha_live/state/app_state.dart';

void main() {
  group('local demo activity', () {
    test('simulates wallet and checkout without changing account balance', () {
      final appState = AppState();
      final accountBalance = appState.availableBalance;
      final orderCount = appState.demoOrders.length;
      final startingDemoBalance = appState.demoBalance;

      appState.simulateWalletActivity(
        amountZar: 50,
        type: TransactionType.topup,
      );
      expect(appState.demoBalance, startingDemoBalance + 50);

      final order = appState.simulateCheckout(
        itemTitle: 'Test listing',
        amountZar: 30,
        deliveryMethod: 'Buyer pickup (simulation)',
        paymentMethod: 'Temporary demo wallet',
        useDemoWallet: true,
      );

      expect(appState.demoBalance, startingDemoBalance + 20);
      expect(appState.demoOrders, hasLength(orderCount + 1));
      expect(appState.demoOrders.first.id, order.id);
      expect(order.status, 'Simulated checkout · no order placed');
      expect(appState.availableBalance, accountBalance);

      appState.advanceDemoOrder(order.id);
      expect(appState.demoOrders.first.status, 'Simulation · delivery not booked');
      appState.advanceDemoOrder(order.id);
      expect(appState.demoOrders.first.status, 'Simulation complete · no delivery occurred');
      appState.advanceDemoOrder(order.id);
      expect(appState.demoOrders.first.status, 'Simulation complete · no delivery occurred');

      appState.simulateCheckout(
        itemTitle: 'Second test listing',
        amountZar: 10,
        deliveryMethod: 'Buyer pickup (simulation)',
        paymentMethod: 'Card simulation',
      );
      expect(appState.demoBalance, startingDemoBalance + 20);
      expect(appState.demoOrders, hasLength(orderCount + 2));
      expect(appState.demoOrders.first.paymentMethod, 'Card simulation');
      expect(appState.availableBalance, accountBalance);
    });

    test('rejects a demo withdrawal larger than the local balance', () {
      final appState = AppState();
      expect(
        () => appState.simulateWalletActivity(
          amountZar: appState.demoBalance + 1,
          type: TransactionType.withdrawal,
        ),
        throwsStateError,
      );
    });
  });
}
