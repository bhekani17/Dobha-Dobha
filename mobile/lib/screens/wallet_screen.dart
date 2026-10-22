import 'package:flutter/material.dart';

import '../models/escrow_order.dart';
import '../models/user_profile.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/escrow_tracker_badge.dart';
import '../widgets/offer_card.dart';
import '../widgets/ui.dart';

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final appState = AppState();
        final activeOrders = appState.orders
            .where(
              (o) =>
                  o.canReview ||
                  (o.status != EscrowStatus.payoutReleased &&
                      o.status != EscrowStatus.refunded),
            )
            .toList();
        final openOffers = appState.offers.where((o) => o.isOpen).toList();
        final txs = appState.transactions;

        return Scaffold(
          appBar: AppBar(
            toolbarHeight: 68,
            title: const Text('Wallet & Orders'),
          ),
          body: RefreshIndicator(
            color: DobhaColors.green,
            backgroundColor: DobhaColors.cardElevated,
            onRefresh: () => Future.wait([
              appState.loadWallet(),
              appState.loadOrders(),
              appState.loadOffers(),
            ]),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                if (openOffers.isNotEmpty) ...[
                  const SectionTitle('Offers'),
                  ...openOffers.map((o) => OfferCard(offer: o)),
                  const SizedBox(height: 20),
                  const SectionTitle('Orders'),
                ],
                if (activeOrders.isEmpty)
                  AppWell(
                    radius: 18,
                    padding: const EdgeInsets.all(20),
                    child: Text(
                      'No orders in progress. When you buy or sell a piece, you follow it here.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: DobhaColors.muted,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  )
                else
                  ...activeOrders.map((ord) => EscrowTrackerCard(order: ord)),
                const SizedBox(height: 28),
                const SectionTitle('Wallet'),
                // Main balance
                AppCard(
                  radius: 20,
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Balance',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: DobhaColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'R ${appState.availableBalance.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 36,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -1.2,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Row(
                        children: [
                          Expanded(
                            child: _BalanceWell(
                              label: 'On hold for your orders',
                              amount: appState.lockedEscrowFunds,
                              color: DobhaColors.cyan,
                              icon: Icons.lock_outline_rounded,
                            ),
                          ),
                          if (appState.isVendor) ...[
                            const SizedBox(width: 12),
                            Expanded(
                              child: _BalanceWell(
                                label: 'Coming to you from sales',
                                amount: appState.vendorPendingPayouts,
                                color: DobhaColors.amber,
                                icon: Icons.hourglass_top_rounded,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),
                const SectionTitle('History'),
                if (txs.isEmpty)
                  AppWell(
                    radius: 18,
                    padding: EdgeInsets.all(20),
                    child: Center(
                      child: Text(
                        'No transactions yet.',
                        style: TextStyle(
                          color: DobhaColors.muted,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  )
                else
                  AppCard(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: Column(
                      children: [
                        for (var i = 0; i < txs.length; i++) ...[
                          if (i > 0)
                            Divider(height: 1, color: DobhaColors.border),
                          _buildTxTile(txs[i]),
                        ],
                      ],
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildTxTile(WalletTransaction tx) {
    final color = tx.isCredit ? DobhaColors.green : DobhaColors.cyan;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          AppWell(
            circle: true,
            padding: const EdgeInsets.all(9),
            tint: color,
            child: Icon(
              tx.isCredit ? Icons.south_west_rounded : Icons.north_east_rounded,
              color: color,
              size: 16,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tx.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                Text(
                  tx.subtitle,
                  style: TextStyle(fontSize: 12, color: DobhaColors.muted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${tx.isCredit ? "+" : "-"}R ${tx.amountZar.toStringAsFixed(0)}',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                  color: tx.isCredit ? DobhaColors.green : DobhaColors.text,
                ),
              ),
              Text(
                tx.status,
                style: TextStyle(fontSize: 11, color: DobhaColors.muted),
              ),
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

  const _BalanceWell({
    required this.label,
    required this.amount,
    required this.color,
    required this.icon,
  });

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
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: DobhaColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'R ${amount.toStringAsFixed(0)}',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: color,
              letterSpacing: -0.3,
            ),
          ),
        ],
      ),
    );
  }
}
