import 'package:dobha_live/models/user_profile.dart';
import 'package:dobha_live/state/app_state.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('demo wallet activity is recorded without changing balances', () {
    final state = AppState();
    final availableBefore = state.availableBalance;
    final lockedBefore = state.lockedEscrowFunds;
    final pendingBefore = state.vendorPendingPayouts;

    state.recordDemoWalletActivity(
      amountZar: 125,
      type: TransactionType.topup,
      method: 'Card simulation',
    );

    final transaction = state.transactions.firstWhere((entry) => entry.isDemo);
    expect(transaction.amountZar, 125);
    expect(transaction.status, 'Demo · not processed');
    expect(transaction.subtitle, contains('No funds moved'));
    expect(state.availableBalance, availableBefore);
    expect(state.lockedEscrowFunds, lockedBefore);
    expect(state.vendorPendingPayouts, pendingBefore);
  });

  test('demo wallet activity rejects invalid amounts', () {
    expect(
      () => AppState().recordDemoWalletActivity(
        amountZar: 0,
        type: TransactionType.withdrawal,
      ),
      throwsArgumentError,
    );
  });
}
