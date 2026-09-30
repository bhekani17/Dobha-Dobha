
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api.dart';
import '../google_auth.dart';
import '../models/escrow_order.dart';
import '../models/thrift_item.dart';
import '../models/user_profile.dart';

/// A photo or video picked on the device, waiting to be uploaded with a listing.
class PendingMedia {
  final Uint8List bytes;
  final String contentType;
  const PendingMedia(this.bytes, this.contentType);

  bool get isVideo => contentType.startsWith('video/');
}

/// App-wide state backed by the Dobha server. Screens listen to this and call
/// its methods; failures surface as [ApiException]s with user-facing messages.
class AppState extends ChangeNotifier {
  static final AppState _instance = AppState._internal();
  factory AppState() => _instance;
  AppState._internal();

  static const _tokenKey = 'auth_token';

  Api _api = Api(defaultServerUrl());
  Api get api => _api;
  String get serverUrl => _api.baseUrl;

  bool _restored = false;
  UserProfile? _user;

  List<ThriftItem> _feed = [];
  bool _feedLoading = false;
  String? _feedError;
  List<ThriftItem> _myItems = [];
  List<ThriftItem> _saved = [];
  List<EscrowOrder> _orders = [];
  List<WalletTransaction> _transactions = [];
  double _available = 0, _locked = 0, _pending = 0;

  // Item a vendor chose to pin when they next go live (device-local).
  ThriftItem? _livePinnedItem;

  bool get restored => _restored;
  bool get isLoggedIn => _user != null;
  UserProfile get user => _user!;
  bool get isVendor => _user?.isVendor ?? false;
  List<ThriftItem> get feedItems => List.unmodifiable(_feed);
  bool get feedLoading => _feedLoading;
  String? get feedError => _feedError;
  List<ThriftItem> get vendorInventory => List.unmodifiable(_myItems);
  List<ThriftItem> get savedItems => List.unmodifiable(_saved);
  List<EscrowOrder> get orders => List.unmodifiable(_orders);
  List<WalletTransaction> get transactions => List.unmodifiable(_transactions);
  double get availableBalance => _available;
  double get lockedEscrowFunds => _locked;
  double get vendorPendingPayouts => _pending;
  ThriftItem? get livePinnedItem => _livePinnedItem;

  // ---- Session ----

  /// Restores a saved login. Called once by the splash screen.
  Future<void> restoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(_tokenKey);
      if (token != null) {
        _api.token = token;
        // A blip (bad signal, server hiccup) shouldn't look like being logged out: retry before giving up.
        dynamic res;
        for (var attempt = 1;; attempt++) {
          try {
            res = await _api.get('/api/me');
            break;
          } on ApiException catch (e) {
            if (e.isUnauthorized || attempt == 3) rethrow;
            await Future.delayed(Duration(milliseconds: 600 * attempt));
          }
        }
        _user = UserProfile.fromJson(res['user'] as Map<String, dynamic>);
        refreshAll();
      }
    } on ApiException catch (e) {
      if (e.isUnauthorized) await _clearSession();
      // Offline: stay signed out for now; the user can retry from the welcome screen.
    } catch (e) {
      // Never leave the app stuck on the splash screen.
      debugPrint('Session restore failed: $e');
    }
    _restored = true;
    notifyListeners();
  }

  Future<void> register({
    required String name,
    required String handle,
    required String email,
    required String password,
    String phone = '',
  }) async {
    final res = await _api.post('/api/auth/register', {
      'name': name,
      'handle': handle,
      'email': email,
      'password': password,
      'phone': phone,
    });
    await _startSession(res as Map<String, dynamic>);
  }

  Future<void> login({required String email, required String password}) async {
    final res = await _api.post('/api/auth/login', {'email': email, 'password': password});
    await _startSession(res as Map<String, dynamic>);
  }

  /// Exchanges a verified Google ID token for a Dobha session.
  Future<void> loginWithGoogle(String idToken) async {
    final res = await _api.post('/api/auth/google', {'idToken': idToken});
    await _startSession(res as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      await _api.post('/api/auth/logout');
    } catch (_) {
      // Signing out locally is what matters.
    }
    await GoogleAuth.signOut();
    await _clearSession();
    notifyListeners();
  }

  Future<void> _startSession(Map<String, dynamic> res) async {
    final token = res['token'] as String;
    _api.token = token;
    _user = UserProfile.fromJson(res['user'] as Map<String, dynamic>);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    notifyListeners();
    refreshAll();
  }

  Future<void> _clearSession() async {
    _api.token = null;
    _user = null;
    _feed = [];
    _myItems = [];
    _saved = [];
    _orders = [];
    _transactions = [];
    _available = _locked = _pending = 0;
    _livePinnedItem = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  /// Runs a request; an expired session signs the user out.
  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await request();
    } on ApiException catch (e) {
      if (e.isUnauthorized && _user != null) {
        await _clearSession();
        notifyListeners();
      }
      rethrow;
    }
  }

  void setServerUrl(String url) {
    _api = Api(url, token: _api.token);
    notifyListeners();
  }

  // ---- Loading ----

  Future<void> refreshAll() async {
    await Future.wait([
      loadFeed(),
      loadOrders(),
      loadWallet(),
      loadSaved(),
      if (isVendor) loadMyItems(),
    ].map((f) => f.catchError((_) {})));
  }

  Future<void> loadFeed() async {
    _feedLoading = true;
    _feedError = null;
    notifyListeners();
    try {
      final res = await _call(() => _api.get('/api/items'));
      _feed = _items(res);
    } on ApiException catch (e) {
      _feedError = e.message;
    } finally {
      _feedLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadMyItems() async {
    _myItems = _items(await _call(() => _api.get('/api/items/mine')));
    notifyListeners();
  }

  Future<void> loadSaved() async {
    _saved = _items(await _call(() => _api.get('/api/saved')));
    notifyListeners();
  }

  Future<void> loadOrders() async {
    final res = await _call(() => _api.get('/api/orders'));
    _orders = (res['orders'] as List).map((o) => EscrowOrder.fromJson(o as Map<String, dynamic>)).toList();
    notifyListeners();
  }

  Future<void> loadWallet() async {
    _applyWallet(await _call(() => _api.get('/api/wallet')));
    notifyListeners();
  }

  List<ThriftItem> _items(dynamic res) =>
      (res['items'] as List).map((i) => ThriftItem.fromJson(i as Map<String, dynamic>)).toList();

  void _applyWallet(dynamic res) {
    _available = (res['availableZar'] as num).toDouble();
    _locked = (res['lockedZar'] as num).toDouble();
    _pending = (res['pendingZar'] as num).toDouble();
    _transactions =
        (res['transactions'] as List).map((t) => WalletTransaction.fromJson(t as Map<String, dynamic>)).toList();
  }

  // ---- Profile ----

  Future<void> updateProfile({
    String? name,
    String? phone,
    String? bio,
    String? location,
    String? shopName,
    String? stallLocation,
    UserRole? role,
  }) async {
    final res = await _call(() => _api.patch('/api/me', {
          'name': ?name,
          'phone': ?phone,
          'bio': ?bio,
          'location': ?location,
          'shopName': ?shopName,
          'stallLocation': ?stallLocation,
          if (role != null) 'role': role.name,
        }));
    final wasVendor = isVendor;
    _user = UserProfile.fromJson(res['user'] as Map<String, dynamic>);
    notifyListeners();
    if (isVendor && !wasVendor) await loadMyItems();
  }

  /// Replaces the profile picture, or removes it when [bytes] is null.
  Future<void> setAvatar(Uint8List? bytes, {String contentType = 'image/jpeg'}) async {
    final res = await _call(() =>
        bytes == null ? _api.delete('/api/me/avatar') : _api.putBytes('/api/me/avatar', bytes, contentType));
    _user = UserProfile.fromJson(res['user'] as Map<String, dynamic>);
    notifyListeners();
    // Listings embed the seller's picture.
    if (isVendor) refreshAll();
  }

  // ---- Items ----

  Future<void> toggleLike(String itemId) => _toggle(itemId, 'like');
  Future<void> toggleSave(String itemId) async {
    await _toggle(itemId, 'save');
    await loadSaved();
  }

  Future<void> _toggle(String itemId, String action) async {
    final res = await _call(() => _api.post('/api/items/$itemId/$action'));
    _replaceItem(ThriftItem.fromJson(res['item'] as Map<String, dynamic>));
  }

  void _replaceItem(ThriftItem item) {
    List<ThriftItem> swap(List<ThriftItem> list) => [for (final i in list) i.id == item.id ? item : i];
    _feed = swap(_feed);
    _myItems = swap(_myItems);
    _saved = swap(_saved);
    notifyListeners();
  }

  Future<ThriftItem> createItem({
    required String title,
    required double priceZar,
    required String condition,
    required String size,
    required String category,
    String description = '',
    String caption = '',
    List<PendingMedia> media = const [],
    void Function(int uploaded, int total)? onProgress,
  }) async {
    // Upload in gallery order; the server keeps that order.
    final keys = <String>[];
    for (final m in media) {
      onProgress?.call(keys.length, media.length);
      keys.add(await _call(() => _api.uploadMedia(m.bytes, m.contentType)));
    }
    onProgress?.call(keys.length, media.length);
    final res = await _call(() => _api.post('/api/items', {
          'title': title,
          'priceZar': priceZar,
          'condition': condition,
          'size': size,
          'category': category,
          'description': description,
          'caption': caption,
          'media': [for (final k in keys) {'key': k}],
        }));
    final item = ThriftItem.fromJson(res['item'] as Map<String, dynamic>);
    _myItems = [item, ..._myItems];
    _feed = [item, ..._feed];
    notifyListeners();
    return item;
  }

  Future<void> removeItem(String itemId) async {
    await _call(() => _api.delete('/api/items/$itemId'));
    _myItems = _myItems.where((i) => i.id != itemId).toList();
    _feed = _feed.where((i) => i.id != itemId).toList();
    if (_livePinnedItem?.id == itemId) _livePinnedItem = null;
    notifyListeners();
  }

  Future<List<ItemComment>> comments(String itemId) async {
    final res = await _call(() => _api.get('/api/items/$itemId/comments'));
    return (res['comments'] as List).map((c) => ItemComment.fromJson(c as Map<String, dynamic>)).toList();
  }

  Future<ItemComment> addComment(String itemId, String text) async {
    final res = await _call(() => _api.post('/api/items/$itemId/comments', {'text': text}));
    final item = [..._feed, ..._saved].where((i) => i.id == itemId).firstOrNull;
    if (item != null) _replaceItem(item.copyWithComments(item.commentsCount + 1));
    return ItemComment.fromJson(res['comment'] as Map<String, dynamic>);
  }

  void pinItemToLive(ThriftItem item) {
    _livePinnedItem = item;
    notifyListeners();
  }

  void unpinLiveItem() {
    _livePinnedItem = null;
    notifyListeners();
  }

  // ---- Orders & wallet (payments simulated server-side) ----

  Future<EscrowOrder> checkout({
    required ThriftItem item,
    required String deliveryMethod,
    required String paymentMethod,
    required String deliveryAddress,
  }) async {
    final res = await _call(() => _api.post('/api/orders', {
          'itemId': item.id,
          'deliveryMethod': deliveryMethod,
          'paymentMethod': paymentMethod,
          'deliveryAddress': deliveryAddress,
        }));
    final order = EscrowOrder.fromJson(res['order'] as Map<String, dynamic>);
    _orders = [order, ..._orders];
    _feed = _feed.where((i) => i.id != item.id).toList();
    notifyListeners();
    loadWallet().catchError((_) {});
    return order;
  }

  Future<void> dispatchOrder(String orderId) => _orderAction(orderId, 'dispatch');
  Future<void> confirmOrder(String orderId) => _orderAction(orderId, 'confirm');
  Future<void> disputeOrder(String orderId) => _orderAction(orderId, 'dispute');

  Future<void> _orderAction(String orderId, String action) async {
    final res = await _call(() => _api.post('/api/orders/$orderId/$action'));
    final order = EscrowOrder.fromJson(res['order'] as Map<String, dynamic>);
    _orders = [for (final o in _orders) o.id == orderId ? order : o];
    notifyListeners();
    await loadWallet().catchError((_) {});
    if (action == 'confirm') {
      final me = await _call(() => _api.get('/api/me'));
      _user = UserProfile.fromJson(me['user'] as Map<String, dynamic>);
      notifyListeners();
    }
  }

  Future<void> topUpWallet(double amountZar, String method) async {
    _applyWallet(await _call(() => _api.post('/api/wallet/topup', {'amountZar': amountZar, 'method': method})));
    notifyListeners();
  }

  Future<void> withdrawFunds(double amountZar, String bank, String account) async {
    _applyWallet(await _call(() => _api.post('/api/wallet/withdraw', {'amountZar': amountZar, 'bank': bank, 'account': account})));
    notifyListeners();
  }
}

extension on ThriftItem {
  ThriftItem copyWithComments(int count) => ThriftItem(
        id: id,
        title: title,
        description: description,
        haulCaption: haulCaption,
        priceZar: priceZar,
        originalPriceZar: originalPriceZar,
        condition: condition,
        size: size,
        category: category,
        photoUrl: photoUrl,
        media: media,
        sellerId: sellerId,
        sellerName: sellerName,
        sellerHandle: sellerHandle,
        sellerLocation: sellerLocation,
        sellerAvatarUrl: sellerAvatarUrl,
        likesCount: likesCount,
        commentsCount: count,
        isLiked: isLiked,
        isSaved: isSaved,
        isClaimed: isClaimed,
        createdAt: createdAt,
      );
}
