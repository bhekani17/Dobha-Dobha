import 'package:flutter/material.dart';

import '../api.dart';
import '../models/social.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'ui.dart';

class CheckoutModal extends StatefulWidget {
  final List<ThriftItem> items;
  final Offer? offer;

  const CheckoutModal({super.key, required this.items, this.offer});

  static Future<void> show(
    BuildContext context,
    ThriftItem item, {
    Offer? offer,
  }) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => CheckoutModal(items: [item], offer: offer),
  );

  static Future<void> showCart(BuildContext context) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (ctx) => CheckoutModal(items: AppState().cartAvailable),
      );

  @override
  State<CheckoutModal> createState() => _CheckoutModalState();
}

class _CheckoutModalState extends State<CheckoutModal> {
  final _formKey = GlobalKey<FormState>();
  final _address = TextEditingController();
  List<String> _providers = [];
  String? _selectedItemId;
  String? _provider;
  String _deliveryMethod = 'seller_pickup';
  String? _loadError;
  bool _loadingProviders = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadProviders();
  }

  @override
  void dispose() {
    _address.dispose();
    super.dispose();
  }

  Future<void> _loadProviders() async {
    try {
      final providers = await AppState().loadSandboxPaymentProviders();
      if (!mounted) return;
      setState(() {
        _providers = providers;
        _provider = providers.isEmpty ? null : providers.first;
        _loadingProviders = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loadError = error.message;
        _loadingProviders = false;
      });
    }
  }

  Future<void> _requestToBuy(ThriftItem item) async {
    final appState = AppState();
    if (!appState.isLoggedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in to request to buy this item.')),
      );
      return;
    }
    if (item.sellerId == appState.user.id) return;

    final messenger = ScaffoldMessenger.of(context);
    try {
      await appState.sendPurchaseRequest(
        item.sellerId,
        item,
        'I would like to buy "${item.title}" for ${item.formattedPrice}. Please confirm availability and arrange payment and collection with me.',
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            'Purchase request sent. Arrange payment and collection with the seller directly; Dobha has not processed payment.',
          ),
        ),
      );
    } on ApiException catch (error) {
      if (mounted) {
        messenger.showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  Future<void> _createTestOrder() async {
    if (!_formKey.currentState!.validate() || _selectedItemId == null) return;
    if (_provider == null || !_providers.contains(_provider)) {
      setState(() => _loadError = 'No test payment provider is enabled.');
      return;
    }
    final item = widget.items.firstWhere(
      (entry) => entry.id == _selectedItemId,
    );
    setState(() => _busy = true);
    try {
      await AppState().checkout(
        item: item,
        deliveryMethod: _deliveryMethod,
        paymentMethod: _provider!,
        deliveryAddress: _address.text.trim(),
      );
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      Navigator.of(context).pop();
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            'Test order request sent. The seller must accept before checkout can continue; no payment has been made.',
          ),
        ),
      );
    } on ApiException catch (error) {
      if (mounted) setState(() => _loadError = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final availableItems = widget.items
        .where((item) => !item.isClaimed)
        .toList();
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.88,
        ),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            20,
            14,
            20,
            MediaQuery.viewInsetsOf(context).bottom + 20,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  margin: const EdgeInsets.only(bottom: 18),
                  decoration: Surfaces.well(radius: 3),
                ),
              ),
              const Text(
                'Checkout options',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 8),
              AppWell(
                radius: 14,
                child: Text(
                  'Test checkout only. No real payment is charged, wallet funds are added, or seller payout is made.',
                  style: TextStyle(
                    color: DobhaColors.textSecondary,
                    height: 1.4,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              if (availableItems.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Text(
                    'There are no available items in your cart.',
                    style: TextStyle(color: DobhaColors.textSecondary),
                  ),
                )
              else
                for (final item in availableItems) ...[
                  AppWell(
                    radius: 14,
                    margin: const EdgeInsets.only(bottom: 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          item.title,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${item.sellerName} · ${item.formattedPrice}',
                          style: TextStyle(
                            color: DobhaColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          children: [
                            OutlinedButton(
                              onPressed: () => _requestToBuy(item),
                              child: const Text('Request to buy directly'),
                            ),
                            if (_providers.isNotEmpty)
                              FilledButton(
                                onPressed: _busy
                                    ? null
                                    : () => setState(() {
                                        _selectedItemId = item.id;
                                        _loadError = null;
                                      }),
                                child: Text(
                                  _selectedItemId == item.id
                                      ? 'Selected for test checkout'
                                      : 'Test checkout',
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              if (_loadingProviders)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_loadError != null && _selectedItemId == null)
                AppWell(
                  radius: 14,
                  tint: DobhaColors.red,
                  child: Text(
                    _loadError!,
                    style: TextStyle(color: DobhaColors.red),
                  ),
                )
              else if (_providers.isEmpty)
                AppWell(
                  radius: 14,
                  child: Text(
                    'Test checkout is not enabled here. Direct purchase requests remain available.',
                    style: TextStyle(color: DobhaColors.textSecondary),
                  ),
                ),
              if (_selectedItemId != null) ...[
                const SizedBox(height: 4),
                Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue: _deliveryMethod,
                        decoration: const InputDecoration(
                          labelText: 'Delivery option',
                        ),
                        items: const [
                          DropdownMenuItem(
                            value: 'seller_pickup',
                            child: Text('Meet seller / pickup (manual test)'),
                          ),
                          DropdownMenuItem(
                            value: 'uber_direct_test',
                            child: Text('Courier status (manual test only)'),
                          ),
                        ],
                        onChanged: (value) {
                          if (value != null) {
                            setState(() => _deliveryMethod = value);
                          }
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _address,
                        minLines: 2,
                        maxLines: 3,
                        maxLength: 500,
                        decoration: const InputDecoration(
                          labelText: 'Delivery or agreed pickup address',
                          alignLabelWithHint: true,
                        ),
                        validator: (value) {
                          final address = value?.trim() ?? '';
                          if (address.length < 8) {
                            return 'Enter at least 8 characters.';
                          }
                          if (address.length > 500) {
                            return 'Address must be 500 characters or fewer.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        initialValue: _provider,
                        decoration: const InputDecoration(
                          labelText: 'Test payment provider',
                        ),
                        items: [
                          for (final provider in _providers)
                            DropdownMenuItem(
                              value: provider,
                              child: Text(switch (provider) {
                                'payfast_sandbox' => 'PayFast test checkout',
                                'escrow_sandbox' => 'Escrow.com test checkout',
                                _ => provider,
                              }),
                            ),
                        ],
                        onChanged: (value) => setState(() => _provider = value),
                      ),
                      const SizedBox(height: 8),
                      if (_loadError != null)
                        AppWell(
                          radius: 14,
                          tint: DobhaColors.red,
                          margin: const EdgeInsets.only(bottom: 10),
                          child: Text(
                            _loadError!,
                            style: TextStyle(color: DobhaColors.red),
                          ),
                        ),
                      AppButton(
                        color: DobhaColors.green,
                        onPressed: _busy ? null : _createTestOrder,
                        child: _busy
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.black,
                                ),
                              )
                            : const Text('Send test order'),
                      ),
                    ],
                  ),
                ),
              ],
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Close'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
