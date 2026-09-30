import 'package:flutter/material.dart';

import '../models/escrow_order.dart';
import '../models/user_profile.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/escrow_tracker_badge.dart';

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  void _showTopUpDialog(BuildContext context) {
    final amountCtrl = TextEditingController(text: '300');
    String method = 'Capitec Pay (Instant)';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: DobhaColors.card,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.add_circle_outline_rounded, color: DobhaColors.green, size: 22),
              SizedBox(width: 8),
              Text('Top Up Spending Wallet', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Add test funds to instantly claim drops into Escrow.', style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
              const SizedBox(height: 14),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Amount (ZAR)', prefixText: 'R '),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: method,
                decoration: const InputDecoration(labelText: 'Payment Provider'),
                dropdownColor: DobhaColors.card,
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
                if (amount > 0) {
                  AppState().topUpWallet(amount, method);
                  Navigator.of(ctx).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      backgroundColor: DobhaColors.green,
                      content: Text('Deposited R ${amount.toStringAsFixed(0)} via $method!'),
                    ),
                  );
                }
              },
              child: const Text('Top Up Now'),
            ),
          ],
        ),
      ),
    );
  }

  void _showWithdrawDialog(BuildContext context) {
    final amountCtrl = TextEditingController(text: '250');
    final accountCtrl = TextEditingController(text: '1234567890');
    String bank = 'Capitec Bank';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: DobhaColors.card,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.account_balance_rounded, color: DobhaColors.cyan, size: 22),
              SizedBox(width: 8),
              Text('Withdraw Payout', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Available to withdraw: R ${AppState().availableBalance.toStringAsFixed(0)}',
                style: const TextStyle(fontSize: 12, color: DobhaColors.green, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Amount (ZAR)', prefixText: 'R '),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: bank,
                decoration: const InputDecoration(labelText: 'Bank'),
                dropdownColor: DobhaColors.card,
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
                final success = AppState().withdrawFunds(amount, bank, acc);
                Navigator.of(ctx).pop();
                if (success) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      backgroundColor: DobhaColors.cyan,
                      content: Text('Withdrew R ${amount.toStringAsFixed(0)} to $bank ($acc)!'),
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Insufficient available balance.')),
                  );
                }
              },
              child: const Text('Confirm Cash-out'),
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
            title: const Text.rich(
              TextSpan(children: [
                TextSpan(text: 'E-Wallet & '),
                TextSpan(text: 'Escrow Vault', style: TextStyle(color: DobhaColors.cyan)),
              ]),
            ),
          ),
          body: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            children: [
              // Escrow Flow Diagram Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      DobhaColors.escrowIndigo.withValues(alpha: 0.25),
                      DobhaColors.card,
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: DobhaColors.escrowIndigo.withValues(alpha: 0.5)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.security_rounded, color: DobhaColors.cyan, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'HOW DOBHA ESCROW PROTECTS YOU',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: DobhaColors.cyan, letterSpacing: 0.5),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _buildVisualEscrowFlow(),
                    const SizedBox(height: 12),
                    const Text(
                      'Street markets carry physical safety and scam risks. Dobha locks buyer funds in an in-app vault until you physically inspect & confirm the piece matches the live stream.',
                      style: TextStyle(fontSize: 11.5, color: DobhaColors.textSecondary, height: 1.3),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Balances Grid
              Row(
                children: [
                  Expanded(
                    child: _buildBalanceCard(
                      title: 'Available Balance',
                      amountZar: appState.availableBalance,
                      color: DobhaColors.green,
                      icon: Icons.account_balance_wallet_rounded,
                      subtitle: 'Ready to spend / withdraw',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildBalanceCard(
                      title: 'Locked in Escrow',
                      amountZar: appState.lockedEscrowFunds,
                      color: DobhaColors.cyan,
                      icon: Icons.lock_outline_rounded,
                      subtitle: 'Protected in live orders',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              if (appState.isVendor) ...[
                _buildBalanceCard(
                  title: 'Pending Vendor Payouts',
                  amountZar: appState.vendorPendingPayouts,
                  color: DobhaColors.amber,
                  icon: Icons.hourglass_top_rounded,
                  subtitle: 'Releases automatically once shoppers confirm "Received as Shown"',
                ),
                const SizedBox(height: 12),
              ],

              // Quick Actions
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => _showTopUpDialog(context),
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Top Up Wallet'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _showWithdrawDialog(context),
                      icon: const Icon(Icons.north_east_rounded, size: 18),
                      label: const Text('Cash Out'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Active Escrow Contracts
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Active Escrow Contracts (${ordersInEscrow.length})',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  ),
                  const Text('Live Vault Protection', style: TextStyle(color: DobhaColors.cyan, fontSize: 11, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 8),

              if (ordersInEscrow.isEmpty)
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: DobhaColors.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: DobhaColors.border),
                  ),
                  child: const Center(
                    child: Text('No active funds in escrow. All previous orders settled!', style: TextStyle(color: DobhaColors.muted, fontSize: 13)),
                  ),
                )
              else
                ...ordersInEscrow.map((ord) => EscrowTrackerCard(order: ord, isVendorView: appState.isVendor)),

              const SizedBox(height: 24),

              // Transaction Ledger
              const Text('Transaction History', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              const SizedBox(height: 10),

              ...txs.map((tx) => _buildTxTile(tx)),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVisualEscrowFlow() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(10),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _FlowStep(icon: Icons.payment, text: 'Buyer\nPays'),
          Icon(Icons.arrow_forward, size: 14, color: DobhaColors.muted),
          _FlowStep(icon: Icons.shield, text: 'In-App\nEscrow', color: DobhaColors.cyan),
          Icon(Icons.arrow_forward, size: 14, color: DobhaColors.muted),
          _FlowStep(icon: Icons.local_shipping, text: 'Vendor\nShips'),
          Icon(Icons.arrow_forward, size: 14, color: DobhaColors.muted),
          _FlowStep(icon: Icons.verified, text: 'Received\nas Shown', color: DobhaColors.green),
          Icon(Icons.arrow_forward, size: 14, color: DobhaColors.muted),
          _FlowStep(icon: Icons.monetization_on, text: 'Vendor\nPaid', color: DobhaColors.gold),
        ],
      ),
    );
  }

  Widget _buildBalanceCard({
    required String title,
    required double amountZar,
    required Color color,
    required IconData icon,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: DobhaColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: DobhaColors.textSecondary)),
              Icon(icon, size: 18, color: color),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'R ${amountZar.toStringAsFixed(0)}',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: color),
          ),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(fontSize: 10.5, color: DobhaColors.muted)),
        ],
      ),
    );
  }

  Widget _buildTxTile(WalletTransaction tx) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: DobhaColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: DobhaColors.border),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: (tx.isCredit ? DobhaColors.green : DobhaColors.cyan).withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              tx.isCredit ? Icons.south_west_rounded : Icons.north_east_rounded,
              color: tx.isCredit ? DobhaColors.green : DobhaColors.cyan,
              size: 16,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tx.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                Text(tx.subtitle, style: const TextStyle(fontSize: 11, color: DobhaColors.muted), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${tx.isCredit ? "+" : "-"}R ${tx.amountZar.toStringAsFixed(0)}',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: tx.isCredit ? DobhaColors.green : DobhaColors.text,
                ),
              ),
              Text(tx.status, style: const TextStyle(fontSize: 10, color: DobhaColors.muted)),
            ],
          ),
        ],
      ),
    );
  }
}

class _FlowStep extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color color;

  const _FlowStep({required this.icon, required this.text, this.color = Colors.white});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(height: 2),
        Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w700, color: color),
        ),
      ],
    );
  }
}
