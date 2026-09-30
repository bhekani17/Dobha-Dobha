import 'package:flutter/material.dart';

import '../api.dart';
import '../models/escrow_order.dart';
import '../models/user_profile.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/escrow_tracker_badge.dart';
import '../widgets/ui.dart';

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  static Future<void> _run(BuildContext context, Future<void> Function() action, String done) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      messenger.showSnackBar(SnackBar(content: Text(done)));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  void _showTopUpDialog(BuildContext context) {
    final amountCtrl = TextEditingController();
    String method = 'Capitec Pay (Instant)';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.add_circle_outline_rounded, color: DobhaColors.green, size: 22),
              SizedBox(width: 8),
              Text('Top Up Wallet', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Add funds to claim drops instantly into escrow.',
                  style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
              const SizedBox(height: 16),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Amount (ZAR)', prefixText: 'R '),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: method,
                decoration: const InputDecoration(labelText: 'Payment Provider'),
                dropdownColor: DobhaColors.cardElevated,
                items: ['Capitec Pay (Instant)', 'Ozow Instant EFT', 'Standard Bank Card', 'FNB Pay']
                    .map((m) => DropdownMenuItem(value: m, child: Text(m, style: const TextStyle(fontSize: 13))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setDialogState(() => method = val);
                },
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
            FilledButton(
              onPressed: () {
                final amount = double.tryParse(amountCtrl.text.trim()) ?? 0.0;
                if (amount <= 0) return;
                Navigator.of(ctx).pop();
                _run(context, () => AppState().topUpWallet(amount, method), 'Added R ${amount.toStringAsFixed(0)} via $method');
              },
              child: const Text('Top Up'),
            ),
          ],
        ),
      ),
    );
  }

  void _showWithdrawDialog(BuildContext context) {
    final amountCtrl = TextEditingController();
    final accountCtrl = TextEditingController();
    String bank = 'Capitec Bank';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.account_balance_rounded, color: DobhaColors.cyan, size: 22),
              SizedBox(width: 8),
              Text('Withdraw', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Available: R ${AppState().availableBalance.toStringAsFixed(0)}',
                style: const TextStyle(fontSize: 12, color: DobhaColors.green, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Amount (ZAR)', prefixText: 'R '),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: bank,
                decoration: const InputDecoration(labelText: 'Bank'),
                dropdownColor: DobhaColors.cardElevated,
                items: ['Capitec Bank', 'FNB / RMB', 'Standard Bank', 'Nedbank', 'Discovery Bank']
                    .map((b) => DropdownMenuItem(value: b, child: Text(b, style: const TextStyle(fontSize: 13))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setDialogState(() => bank = val);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: accountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Account Number'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
            FilledButton(
              onPressed: () {
                final amount = double.tryParse(amountCtrl.text.trim()) ?? 0.0;
                final acc = accountCtrl.text.trim();
                if (amount <= 0 || acc.isEmpty) return;
                Navigator.of(ctx).pop();
                _run(context, () => AppState().withdrawFunds(amount, bank, acc),
                    'Withdrawal of R ${amount.toStringAsFixed(0)} to $bank requested');
              },
              child: const Text('Withdraw'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final appState = AppState();
        final ordersInEscrow = appState.orders.where((o) => o.status != EscrowStatus.payoutReleased).toList();
        final txs = appState.transactions;

        return Scaffold(
          appBar: AppBar(
            toolbarHeight: 68,
            title: const Text.rich(
              TextSpan(children: [
                TextSpan(text: 'Wallet & '),
                TextSpan(text: 'Escrow', style: TextStyle(color: DobhaColors.cyan)),
              ]),
            ),
          ),
          body: RefreshIndicator(
            color: DobhaColors.green,
            backgroundColor: DobhaColors.cardElevated,
            onRefresh: () => Future.wait([appState.loadWallet(), appState.loadOrders()]),
            child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              // Main balance
              AppCard(
                radius: 26,
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Available Balance',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: DobhaColors.textSecondary)),
                    const SizedBox(height: 6),
                    Text(
                      'R ${appState.availableBalance.toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: DobhaColors.green, letterSpacing: -1),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        Expanded(
                          child: _BalanceWell(
                            label: 'In Escrow',
                            amount: appState.lockedEscrowFunds,
                            color: DobhaColors.cyan,
                            icon: Icons.lock_outline_rounded,
                          ),
                        ),
                        if (appState.isVendor) ...[
                          const SizedBox(width: 12),
                          Expanded(
                            child: _BalanceWell(
                              label: 'Pending Payouts',
                              amount: appState.vendorPendingPayouts,
                              color: DobhaColors.amber,
                              icon: Icons.hourglass_top_rounded,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        Expanded(
                          child: AppButton(
                            color: DobhaColors.green,
                            onPressed: () => _showTopUpDialog(context),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [Icon(Icons.add, size: 18), SizedBox(width: 6), Text('Top Up')],
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: AppButton(
                            onPressed: () => _showWithdrawDialog(context),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [Icon(Icons.north_east_rounded, size: 18), SizedBox(width: 6), Text('Withdraw')],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // How escrow works
              AppCard(
                radius: 24,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.security_rounded, color: DobhaColors.cyan, size: 18),
                        SizedBox(width: 8),
                        Text('HOW DOBHA ESCROW PROTECTS YOU',
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: DobhaColors.cyan, letterSpacing: 0.5)),
                      ],
                    ),
                    const SizedBox(height: 14),
                    const AppWell(
                      radius: 16,
                      padding: EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _FlowStep(icon: Icons.payment, text: 'Buyer\nPays'),
                          Icon(Icons.chevron_right, size: 14, color: DobhaColors.muted),
                          _FlowStep(icon: Icons.shield, text: 'Held in\nEscrow', color: DobhaColors.cyan),
                          Icon(Icons.chevron_right, size: 14, color: DobhaColors.muted),
                          _FlowStep(icon: Icons.local_shipping, text: 'Vendor\nShips'),
                          Icon(Icons.chevron_right, size: 14, color: DobhaColors.muted),
                          _FlowStep(icon: Icons.verified, text: 'Received\nas Shown', color: DobhaColors.green),
                          Icon(Icons.chevron_right, size: 14, color: DobhaColors.muted),
                          _FlowStep(icon: Icons.monetization_on, text: 'Vendor\nPaid', color: DobhaColors.gold),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Your money stays locked in the Dobha vault until you confirm the piece matches what you saw.',
                      style: TextStyle(fontSize: 12, color: DobhaColors.textSecondary, height: 1.35),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              Text('Active Escrow (${ordersInEscrow.length})', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              const SizedBox(height: 12),

              if (ordersInEscrow.isEmpty)
                const AppWell(
                  radius: 18,
                  padding: EdgeInsets.all(20),
                  child: Center(
                    child: Text('No funds in escrow right now.', style: TextStyle(color: DobhaColors.muted, fontSize: 13)),
                  ),
                )
              else
                ...ordersInEscrow.map((ord) => EscrowTrackerCard(order: ord)),

              const SizedBox(height: 28),
              const Text('Transaction History', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              const SizedBox(height: 12),
              if (txs.isEmpty)
                const AppWell(
                  radius: 18,
                  padding: EdgeInsets.all(20),
                  child: Center(child: Text('No transactions yet.', style: TextStyle(color: DobhaColors.muted, fontSize: 13))),
                )
              else
                ...txs.map(_buildTxTile),
            ],
          ),
          ),
        );
      },
    );
  }

  Widget _buildTxTile(WalletTransaction tx) {
    final color = tx.isCredit ? DobhaColors.green : DobhaColors.cyan;
    return AppCard(
      margin: const EdgeInsets.only(bottom: 14),
      radius: 18,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          AppWell(
            circle: true,
            padding: const EdgeInsets.all(9),
            tint: color,
            child: Icon(tx.isCredit ? Icons.south_west_rounded : Icons.north_east_rounded, color: color, size: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tx.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                Text(tx.subtitle,
                    style: const TextStyle(fontSize: 11, color: DobhaColors.muted), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${tx.isCredit ? "+" : "-"}R ${tx.amountZar.toStringAsFixed(0)}',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: tx.isCredit ? DobhaColors.green : DobhaColors.text),
              ),
              Text(tx.status, style: const TextStyle(fontSize: 10, color: DobhaColors.muted)),
            ],
          ),
        ],
      ),
    );
  }
}

class _BalanceWell extends StatelessWidget {
  final String label;
  final double amount;
  final Color color;
  final IconData icon;

  const _BalanceWell({required this.label, required this.amount, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return AppWell(
      radius: 16,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 6),
              Flexible(
                child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: DobhaColors.textSecondary)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text('R ${amount.toStringAsFixed(0)}', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: color)),
        ],
      ),
    );
  }
}

class _FlowStep extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color color;

  const _FlowStep({required this.icon, required this.text, this.color = DobhaColors.text});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(height: 3),
        Text(text, textAlign: TextAlign.center, style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w700, color: color)),
      ],
    );
  }
}
