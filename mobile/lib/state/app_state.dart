import 'dart:math';
import 'package:flutter/foundation.dart';

import '../api.dart';
import '../models/escrow_order.dart';
import '../models/thrift_item.dart';
import '../models/user_profile.dart';

class AppState extends ChangeNotifier {
  static final AppState _instance = AppState._internal();
  factory AppState() => _instance;

  AppState._internal() {
    _initMockData();
  }

  // Current User
  UserProfile _user = const UserProfile(
    id: 'usr-joburg-01',
    name: 'Thabo Mokoena',
    phone: '+27 82 555 9182',
    handle: '@thabothrifts',
    role: UserRole.shopper,
    avatarInitials: 'TM',
    location: 'Braamfontein, JHB',
    vendorShopName: 'Braam Bale Vault 🇿🇦',
    vendorStallLocation: 'Corner Juta & De Beer St, Stall #12',
    vendorBadge: 'Bale Boss 👑',
    rating: 4.95,
    totalSalesCount: 142,
    totalSalesZar: 48900.0,
    isVerifiedVendor: true,
  );

  // Escrow & Wallet Balances (ZAR)
  double _availableBalance = 950.0;
  double _lockedEscrowFunds = 420.0;
  double _vendorPendingPayouts = 1850.0;

  // Server API
  String _serverUrl = defaultServerUrl();
  Api get api => Api(_serverUrl);

  // Lists
  List<ThriftItem> _feedItems = [];
  List<ThriftItem> _vendorInventory = [];
  List<EscrowOrder> _orders = [];
  List<WalletTransaction> _transactions = [];
  List<String> _savedItemIds = [];

  // Active Pinned Item for Live Selling
  ThriftItem? _livePinnedItem;
  int _countdownSeconds = 60;

  // Getters
  UserProfile get user => _user;
  bool get isVendor => _user.role == UserRole.vendor;
  double get availableBalance => _availableBalance;
  double get lockedEscrowFunds => _lockedEscrowFunds;
  double get vendorPendingPayouts => _vendorPendingPayouts;
  String get serverUrl => _serverUrl;
  List<ThriftItem> get feedItems => List.unmodifiable(_feedItems);
  List<ThriftItem> get vendorInventory => List.unmodifiable(_vendorInventory);
  List<EscrowOrder> get orders => List.unmodifiable(_orders);
  List<WalletTransaction> get transactions => List.unmodifiable(_transactions);
  List<String> get savedItemIds => List.unmodifiable(_savedItemIds);
  ThriftItem? get livePinnedItem => _livePinnedItem;
  int get countdownSeconds => _countdownSeconds;

  void setServerUrl(String url) {
    _serverUrl = url;
    notifyListeners();
  }

  void toggleRole() {
    final nextRole = _user.role == UserRole.shopper ? UserRole.vendor : UserRole.shopper;
    _user = _user.copyWith(role: nextRole);
    notifyListeners();
  }

  void updateUserProfile({
    String? name,
    String? phone,
    String? vendorShopName,
    String? vendorStallLocation,
  }) {
    _user = _user.copyWith(
      name: name,
      phone: phone,
      vendorShopName: vendorShopName,
      vendorStallLocation: vendorStallLocation,
    );
    notifyListeners();
  }

  void toggleLike(String itemId) {
    final index = _feedItems.indexWhere((it) => it.id == itemId);
    if (index != -1) {
      final item = _feedItems[index];
      final newLiked = !item.isLiked;
      _feedItems[index] = item.copyWith(
        isLiked: newLiked,
        likesCount: newLiked ? item.likesCount + 1 : max(0, item.likesCount - 1),
      );
      notifyListeners();
    }
  }

  void toggleSave(String itemId) {
    if (_savedItemIds.contains(itemId)) {
      _savedItemIds.remove(itemId);
    } else {
      _savedItemIds.add(itemId);
    }
    final index = _feedItems.indexWhere((it) => it.id == itemId);
    if (index != -1) {
      final item = _feedItems[index];
      _feedItems[index] = item.copyWith(isSaved: _savedItemIds.contains(itemId));
    }
    notifyListeners();
  }

  // Instant Claim & Escrow Checkout
  EscrowOrder claimAndCheckoutItem({
    required ThriftItem item,
    required String deliveryMethod,
    required String paymentMethod,
    required String deliveryAddress,
    double shippingFeeZar = 50.0,
  }) {
    final orderId = 'DB-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
    final vaultRef = 'ESC-ZAR-${Random().nextInt(900000) + 100000}';
    final trackingNo = 'PUDO-ZA-${Random().nextInt(89999) + 10000}';

    final order = EscrowOrder(
      id: orderId,
      item: item,
      amountZar: item.priceZar,
      shippingFeeZar: shippingFeeZar,
      status: EscrowStatus.paymentHeld,
      deliveryMethod: deliveryMethod,
      paymentMethod: paymentMethod,
      createdAt: DateTime.now(),
      escrowVaultRef: vaultRef,
      trackingNumber: trackingNo,
      deliveryAddress: deliveryAddress,
    );

    _orders.insert(0, order);

    // Mark item claimed in feed & inventory
    final feedIndex = _feedItems.indexWhere((i) => i.id == item.id);
    if (feedIndex != -1) {
      _feedItems[feedIndex] = _feedItems[feedIndex].copyWith(
        isClaimed: true,
        claimedBy: _user.name,
      );
    }

    // Escrow Accounting: lock buyer funds in escrow vault
    _lockedEscrowFunds += (item.priceZar + shippingFeeZar);
    
    _transactions.insert(
      0,
      WalletTransaction(
        id: 'TX-${DateTime.now().millisecondsSinceEpoch}',
        title: 'Escrow Lock: ${item.title}',
        subtitle: 'Protected payment held until condition confirmed ($vaultRef)',
        amountZar: item.priceZar + shippingFeeZar,
        type: TransactionType.escrowHold,
        date: DateTime.now(),
        status: 'Secured in Escrow 🔒',
        reference: vaultRef,
      ),
    );

    notifyListeners();
    return order;
  }

  // Escrow State Machine Progression
  void markOrderDispatched(String orderId) {
    final index = _orders.indexWhere((o) => o.id == orderId);
    if (index != -1 && _orders[index].status == EscrowStatus.paymentHeld) {
      _orders[index] = _orders[index].copyWith(
        status: EscrowStatus.vendorDispatched,
        dispatchedAt: DateTime.now(),
      );
      notifyListeners();
    }
  }

  // Core Escrow Guarantee: Buyer Confirms "Received as Shown" -> Releases Escrow Funds to Vendor
  void confirmReceivedAndReleaseEscrow(String orderId) {
    final index = _orders.indexWhere((o) => o.id == orderId);
    if (index != -1) {
      final order = _orders[index];
      if (order.status != EscrowStatus.payoutReleased) {
        _orders[index] = order.copyWith(
          status: EscrowStatus.payoutReleased,
          confirmedAt: DateTime.now(),
        );

        // Deduct from locked escrow funds
        _lockedEscrowFunds = max(0, _lockedEscrowFunds - order.totalZar);

        // Disburse funds to vendor wallet
        _vendorPendingPayouts += order.amountZar;
        _availableBalance += order.amountZar * 0.95; // Mock 5% Dobha platform commission

        _transactions.insert(
          0,
          WalletTransaction(
            id: 'TX-REL-${DateTime.now().millisecondsSinceEpoch}',
            title: 'Escrow Released: ${order.item.title}',
            subtitle: 'Shopper verified "Received as Shown" — Funds paid out',
            amountZar: order.amountZar,
            type: TransactionType.escrowRelease,
            date: DateTime.now(),
            status: 'Released to Vendor 💰',
            reference: order.escrowVaultRef,
          ),
        );

        notifyListeners();
      }
    }
  }

  // Top Up Wallet (Simulate Capitec Pay / Ozow EFT)
  void topUpWallet(double amountZar, String method) {
    _availableBalance += amountZar;
    _transactions.insert(
      0,
      WalletTransaction(
        id: 'TX-TOP-${DateTime.now().millisecondsSinceEpoch}',
        title: 'Instant Top-Up ($method)',
        subtitle: 'Funds added to Dobha Spending Wallet',
        amountZar: amountZar,
        type: TransactionType.topup,
        date: DateTime.now(),
        status: 'Completed ✅',
        reference: 'TOP-${Random().nextInt(90000) + 10000}',
      ),
    );
    notifyListeners();
  }

  // Cash Out / Payout to South African Bank
  bool withdrawFunds(double amountZar, String bankName, String accountNumber) {
    if (amountZar > _availableBalance) return false;
    _availableBalance -= amountZar;
    _transactions.insert(
      0,
      WalletTransaction(
        id: 'TX-WDR-${DateTime.now().millisecondsSinceEpoch}',
        title: 'Withdrawal to $bankName',
        subtitle: 'Account ending in ${accountNumber.length > 4 ? accountNumber.substring(accountNumber.length - 4) : accountNumber}',
        amountZar: amountZar,
        type: TransactionType.withdrawal,
        date: DateTime.now(),
        status: 'Completed 🏦',
        reference: 'WDR-${Random().nextInt(90000) + 10000}',
      ),
    );
    notifyListeners();
    return true;
  }

  // Vendor Inventory Management
  void addInventoryItem(ThriftItem item) {
    _vendorInventory.insert(0, item);
    _feedItems.insert(0, item);
    notifyListeners();
  }

  void pinItemToLive(ThriftItem item, {int durationSeconds = 60}) {
    _livePinnedItem = item;
    _countdownSeconds = durationSeconds;
    notifyListeners();
  }

  void unpinLiveItem() {
    _livePinnedItem = null;
    notifyListeners();
  }

  void _initMockData() {
    // Curated high-energy Joburg street thrift drops
    _feedItems = [
      const ThriftItem(
        id: 'item-01',
        title: 'Carhartt Detroit Duck Jacket (J97 MOS)',
        priceZar: 680.0,
        originalPriceZar: 1800.0,
        condition: 'Grade A Vintage',
        size: 'L',
        category: 'Jackets',
        sellerId: 'v-bree-01',
        sellerName: 'Braam Bale Vault',
        sellerHandle: '@braambale',
        sellerLocation: 'Small Street Mall, CBD JHB',
        sellerBadge: 'Bale Boss 👑',
        description: 'Authentic 90s moss green Carhartt Detroit. Perfect street patina with blanket lining intact. Sourced straight from the fresh Grade-A morning bales.',
        tags: ['#Carhartt', '#DetroitJacket', '#Workwear', '#JoburgVintage'],
        likesCount: 248,
        viewsCount: 1890,
        isLiked: false,
        isSaved: false,
        gradientColorsHex: ['#2C1B18', '#6A4029'],
        haulCaption: 'Digging through bale #04 this morning in Downtown Joburg. Look at this grail piece! 📦🔥',
        conditionDetail: 'Zero tears, pristine corduroy collar, heavyweight duck canvas.',
      ),
      const ThriftItem(
        id: 'item-02',
        title: '1996 Nike Center Swoosh Windbreaker',
        priceZar: 380.0,
        originalPriceZar: 950.0,
        condition: '90s Deadstock',
        size: 'XL',
        category: 'Jackets',
        sellerId: 'v-mabo-02',
        sellerName: 'Downtown Stash Co.',
        sellerHandle: '@downtownstash',
        sellerLocation: 'Maboneng Precinct, JHB',
        sellerBadge: 'Top Curator ✨',
        description: 'Crisp 90s nylon shell with embroidered mini swoosh dead center. Elastic waistband and cuffs super snappy. Rare colourway.',
        tags: ['#NikeVintage', '#CenterSwoosh', '#90sStreetwear'],
        likesCount: 412,
        viewsCount: 3100,
        isLiked: true,
        isSaved: true,
        gradientColorsHex: ['#0B1B3D', '#1D4ED8'],
        haulCaption: 'Fresh drop from our Friday morning bale unboxing in Bree Street! ⚡',
        conditionDetail: 'Near mint condition, original zipper puller intact.',
      ),
      const ThriftItem(
        id: 'item-03',
        title: 'Vintage Levi\'s 501 Big E Raw Wash',
        priceZar: 420.0,
        originalPriceZar: 1200.0,
        condition: 'Grade A Vintage',
        size: '32W x 32L',
        category: 'Denim',
        sellerId: 'v-small-03',
        sellerName: 'Kasi Vintage Plug',
        sellerHandle: '@kasivintage',
        sellerLocation: 'Bree Street Taxi Rank Stalls',
        sellerBadge: 'Vintage Plug 🔌',
        description: 'Classic straight-leg 501s with natural honeycomb fades and whiskering. Sturdy 14oz redline selvedge feel.',
        tags: ['#Levis501', '#BigEDenim', '#RawDenim'],
        likesCount: 195,
        viewsCount: 1420,
        isLiked: false,
        isSaved: false,
        gradientColorsHex: ['#172554', '#1E3A8A'],
        haulCaption: 'You know finding clean 501s downtown is pure art. Claim before it vanishes! 👖✨',
        conditionDetail: 'No crotch blowout, natural honeycombs on knees.',
      ),
      const ThriftItem(
        id: 'item-04',
        title: 'Ralph Lauren Polo Sport Arctic Fleece',
        priceZar: 450.0,
        originalPriceZar: 1100.0,
        condition: 'Lightly Worn',
        size: 'M',
        category: 'Knitwear',
        sellerId: 'v-braam-04',
        sellerName: 'Joburg Thrift Guild',
        sellerHandle: '@joburgthriftguild',
        sellerLocation: 'Braamfontein 73 Juta',
        sellerBadge: 'Verified Vendor 🛡️',
        description: 'Heavyweight deep-pile fleece with signature USA flag patch on chest. Super warm for highveld winters.',
        tags: ['#PoloSport', '#VintageRalph', '#StreetFleece'],
        likesCount: 334,
        viewsCount: 2200,
        isLiked: false,
        isSaved: true,
        gradientColorsHex: ['#18181B', '#3F3F46'],
        haulCaption: 'Fleece season check! Grabbed this beauty at the Park Station drop.',
        conditionDetail: 'Thick pile fleece, no pilling, zippers butter smooth.',
      ),
      const ThriftItem(
        id: 'item-05',
        title: 'Stüssy 8-Ball International Pigment Tee',
        priceZar: 290.0,
        originalPriceZar: 650.0,
        condition: '90s Deadstock',
        size: 'L',
        category: 'Vintage Tees',
        sellerId: 'v-bree-01',
        sellerName: 'Braam Bale Vault',
        sellerHandle: '@braambale',
        sellerLocation: 'Small Street Mall, CBD JHB',
        sellerBadge: 'Bale Boss 👑',
        description: 'Single stitch faded pigment black Stüssy tee with iconic 8-ball graphic on back. Sits relaxed and boxy.',
        tags: ['#Stussy', '#8BallTee', '#SingleStitch'],
        likesCount: 520,
        viewsCount: 4500,
        isLiked: true,
        isSaved: false,
        gradientColorsHex: ['#27272A', '#09090B'],
        haulCaption: 'Single stitch vintage grail right out the pile. Who wants it first? 🎱',
        conditionDetail: 'Subtle sun-faded wash, zero graphic cracking.',
      ),
    ];

    // Vendor inventory
    _vendorInventory = [
      _feedItems[0],
      _feedItems[4],
      const ThriftItem(
        id: 'item-06',
        title: 'Dickies 874 Skater Work Pants (Navy)',
        priceZar: 320.0,
        condition: 'Grade A Vintage',
        size: '34W',
        category: 'Workwear',
        sellerId: 'usr-joburg-01',
        sellerName: 'Braam Bale Vault',
        sellerHandle: '@braambale',
        sellerLocation: 'Corner Juta & De Beer St',
        sellerBadge: 'Bale Boss 👑',
        description: 'Boxy cut Dickies 874, already broken in so none of that stiff cardboard feeling.',
        tags: ['#Dickies874', '#Skatewear'],
        likesCount: 88,
        gradientColorsHex: ['#0F172A', '#1E293B'],
      ),
    ];

    // Seed realistic Escrow Orders representing the full lifecycle
    _orders = [
      EscrowOrder(
        id: 'DB-89214',
        item: _feedItems[1], // Nike Windbreaker
        amountZar: 380.0,
        shippingFeeZar: 50.0,
        status: EscrowStatus.vendorDispatched,
        deliveryMethod: 'PUDO Locker-to-Locker',
        paymentMethod: 'Capitec Pay (Instant)',
        createdAt: DateTime.now().subtract(const Duration(days: 1, hours: 4)),
        dispatchedAt: DateTime.now().subtract(const Duration(hours: 6)),
        escrowVaultRef: 'ESC-ZAR-741920',
        trackingNumber: 'PUDO-ZA-99412',
        deliveryAddress: 'Campus Square PUDO Locker, Auckland Park, JHB',
      ),
      EscrowOrder(
        id: 'DB-67310',
        item: _feedItems[0], // Carhartt Jacket
        amountZar: 680.0,
        shippingFeeZar: 60.0,
        status: EscrowStatus.paymentHeld,
        deliveryMethod: 'Courier Guy Door-to-Door',
        paymentMethod: 'Ozow Instant EFT',
        createdAt: DateTime.now().subtract(const Duration(hours: 3)),
        escrowVaultRef: 'ESC-ZAR-883104',
        trackingNumber: 'TCG-ZA-51209',
        deliveryAddress: '24 Biccard St, Braamfontein, Johannesburg',
      ),
      EscrowOrder(
        id: 'DB-41908',
        item: _feedItems[2], // Levis 501
        amountZar: 420.0,
        shippingFeeZar: 0.0,
        status: EscrowStatus.payoutReleased,
        deliveryMethod: 'Downtown Hub Pickup (Free)',
        paymentMethod: 'Dobha Wallet',
        createdAt: DateTime.now().subtract(const Duration(days: 4)),
        dispatchedAt: DateTime.now().subtract(const Duration(days: 3)),
        confirmedAt: DateTime.now().subtract(const Duration(days: 2)),
        escrowVaultRef: 'ESC-ZAR-339218',
        trackingNumber: 'HUB-MABONENG-04',
        deliveryAddress: 'Maboneng Main Street Security Desk Hub',
      ),
    ];

    // Seed transaction history
    _transactions = [
      WalletTransaction(
        id: 'TX-1004',
        title: 'Escrow Lock: Carhartt Detroit Jacket',
        subtitle: 'Protected payment held in vault (ESC-ZAR-883104)',
        amountZar: 740.0,
        type: TransactionType.escrowHold,
        date: DateTime.now().subtract(const Duration(hours: 3)),
        status: 'Secured in Escrow 🔒',
        reference: 'ESC-ZAR-883104',
      ),
      WalletTransaction(
        id: 'TX-1003',
        title: 'Escrow Released: Vintage Levi\'s 501',
        subtitle: 'Buyer confirmed condition — Payout credited',
        amountZar: 420.0,
        type: TransactionType.escrowRelease,
        date: DateTime.now().subtract(const Duration(days: 2)),
        status: 'Released to Vendor 💰',
        reference: 'ESC-ZAR-339218',
      ),
      WalletTransaction(
        id: 'TX-1002',
        title: 'Instant Top-Up (Capitec Pay)',
        subtitle: 'Wallet deposit for instant claims',
        amountZar: 500.0,
        type: TransactionType.topup,
        date: DateTime.now().subtract(const Duration(days: 5)),
        status: 'Completed ✅',
        reference: 'CAP-PAY-98124',
      ),
    ];

    _savedItemIds = ['item-02', 'item-04'];
  }
}
