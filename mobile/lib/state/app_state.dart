
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api.dart';
import '../google_auth.dart';
import '../legal/terms.dart';
import '../models/app_notification.dart';
import '../models/escrow_order.dart';
import '../models/social.dart';
import '../models/support.dart';
import '../models/thrift_item.dart';
import '../models/user_profile.dart';

/// A photo or video picked on the device, waiting to be uploaded with a listing.
class PendingMedia {
  final Uint8List bytes;
  final String contentType;
  const PendingMedia(this.bytes, this.contentType);

  bool get isVideo => contentType.startsWith('video/');
}

/// One photo or video in the listing form: either already on the listing, or newly picked.
class ListingMedia {
  final ItemMedia? existing;
  final PendingMedia? pending;

  const ListingMedia.existing(ItemMedia this.existing) : pending = null;
  const ListingMedia.pending(PendingMedia this.pending) : existing = null;

  bool get isVideo => existing?.isVideo ?? pending!.isVideo;

  /// Storage key of media already on the listing (its URL is `/media/<key>`).
  String? get existingKey => existing?.url.replaceFirst(RegExp(r'^.*?/media/'), '');
}

/// App-wide state backed by the Dobha server. Screens listen to this and call
/// its methods; failures surface as [ApiException]s with user-facing messages.
class AppState extends ChangeNotifier {
  static final AppState _instance = AppState._internal();
  factory AppState() => _instance;
  AppState._internal();

  static const _tokenKey = 'auth_token';
  static const _pollEvery = Duration(seconds: 30);

  final Api _api = Api(defaultServerUrl());
  Api get api => _api;

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
  List<ThriftItem> _searchResults = [];
  List<AppNotification> _notifications = [];
  int _unread = 0;
  int _unreadMessages = 0;
  List<ThriftItem> _cart = [];
  List<Offer> _offers = [];
  int _followers = 0, _following = 0;
  Timer? _pollTimer;

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
  List<ThriftItem> get searchResults => List.unmodifiable(_searchResults);
  List<AppNotification> get notifications => List.unmodifiable(_notifications);
  int get unreadNotifications => _unread;
  int get unreadMessages => _unreadMessages;
  List<ThriftItem> get cart => List.unmodifiable(_cart);

  /// Pieces in the cart that can still be bought.
  List<ThriftItem> get cartAvailable => _cart.where((i) => !i.isClaimed).toList();
  List<Offer> get offers => List.unmodifiable(_offers);
  int get followerCount => _followers;
  int get followingCount => _following;

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
        _startPolling();
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
      'acceptTerms': true,
      'termsVersion': termsVersion,
    });
    await _startSession(res as Map<String, dynamic>);
  }

  Future<void> login({required String email, required String password}) async {
    final res = await _api.post('/api/auth/login', {'email': email, 'password': password});
    await _startSession(res as Map<String, dynamic>);
  }

  /// Exchanges a verified Google ID token for a Dobha session.
  Future<void> loginWithGoogle(String idToken) async {
    final res = await _api.post('/api/auth/google', {'idToken': idToken, 'termsVersion': termsVersion});
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

  /// Emails a 6-digit code for [resetPassword]. Succeeds whether or not the email has an account.
  Future<void> forgotPassword(String email) => _api.post('/api/auth/forgot', {'email': email});

  /// Sets a new password with the emailed code and signs in.
  Future<void> resetPassword({required String email, required String code, required String password}) async {
    final res = await _api.post('/api/auth/reset', {'email': email, 'code': code, 'password': password});
    await _startSession(res as Map<String, dynamic>);
  }

  /// Changes the password; other devices are signed out, this one stays in.
  Future<void> changePassword({required String current, required String password}) =>
      _call(() => _api.post('/api/me/password', {'current': current, 'password': password}));

  /// Deletes the account for good. Password accounts confirm with [password]; Google-only ones type DELETE.
  Future<void> deleteAccount({String? password}) async {
    await _call(() => _api.delete('/api/me', password != null ? {'password': password} : {'confirm': 'DELETE'}));
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
    _startPolling();
  }

  Future<void> _clearSession() async {
    _pollTimer?.cancel();
    _pollTimer = null;
    _api.token = null;
    _user = null;
    _feed = [];
    _myItems = [];
    _saved = [];
    _orders = [];
    _transactions = [];
    _available = _locked = _pending = 0;
    _livePinnedItem = null;
    _searchResults = [];
    _notifications = [];
    _unread = 0;
    _unreadMessages = 0;
    _cart = [];
    _offers = [];
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


  // ---- Notifications ----

  /// Checks for new notifications every [_pollEvery] while signed in. Push
  /// notifications (Firebase) would replace this once a Firebase project is set up.
  void _startPolling() {
    _pollTimer?.cancel();
    pollNotifications();
    _pollTimer = Timer.periodic(_pollEvery, (_) => pollNotifications());
  }

  /// Refreshes the unread count; new ones usually mean an order changed, so orders and wallet reload too.
  Future<void> pollNotifications() async {
    if (_user == null) return;
    try {
      final res = await _call(() => _api.get('/api/notifications/unread'));
      final unread = res['unread'] as int;
      final messages = res['messages'] as int? ?? 0;
      if (unread == _unread && messages == _unreadMessages) return;
      final grew = unread > _unread;
      _unread = unread;
      _unreadMessages = messages;
      notifyListeners();
      if (grew) {
        await Future.wait([loadOrders(), loadWallet(), loadOffers()].map((f) => f.catchError((_) {})));
      }
    } catch (_) {
      // Offline or a server blip; the next poll tries again.
    }
  }

  Future<void> loadNotifications() async {
    final res = await _call(() => _api.get('/api/notifications'));
    _notifications =
        (res['notifications'] as List).map((n) => AppNotification.fromJson(n as Map<String, dynamic>)).toList();
    _unread = res['unread'] as int;
    notifyListeners();
  }

  Future<void> markNotificationsRead() async {
    if (_unread == 0) return;
    await _call(() => _api.post('/api/notifications/read'));
    _unread = 0;
    notifyListeners();
  }

  // ---- Loading ----

  Future<void> refreshAll() async {
    await Future.wait([
      loadFeed(),
      loadOrders(),
      loadWallet(),
      loadSaved(),
      loadCart(),
      loadOffers(),
      loadMyFollowCounts(),
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
    _searchResults = swap(_searchResults);
    _cart = swap(_cart);
    notifyListeners();
  }

  /// Marks an item as in or out of the cart everywhere it is shown.
  void _markInCart(String itemId, bool inCart) {
    List<ThriftItem> mark(List<ThriftItem> list) => [for (final i in list) i.id == itemId ? i.copyWith(inCart: inCart) : i];
    _feed = mark(_feed);
    _saved = mark(_saved);
    _searchResults = mark(_searchResults);
  }

  /// Searches all available pieces on the server. Empty values mean "any".
  Future<List<ThriftItem>> search({String query = '', String? category, String? location}) async {
    final res = await _call(() => _api.get('/api/items', {
          'limit': '50',
          if (query.isNotEmpty) 'q': query,
          'category': ?category,
          'location': ?location,
        }));
    _searchResults = _items(res);
    notifyListeners();
    return _searchResults;
  }

  static const reportReasons = [
    'Fake or counterfeit',
    'Misleading photos or description',
    'Prohibited item',
    'Scam or spam',
    'Offensive',
  ];

  /// Reports a listing. It disappears for this user straight away; admins review it.
  Future<void> reportItem(String itemId, String reason) async {
    await _call(() => _api.post('/api/items/$itemId/report', {'reason': reason}));
    bool keep(ThriftItem i) => i.id != itemId;
    _feed = _feed.where(keep).toList();
    _searchResults = _searchResults.where(keep).toList();
    _saved = _saved.where(keep).toList();
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
    int quantity = 1,
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
          'quantity': quantity,
          'media': [for (final k in keys) {'key': k}],
        }));
    final item = ThriftItem.fromJson(res['item'] as Map<String, dynamic>);
    _myItems = [item, ..._myItems];
    _feed = [item, ..._feed];
    notifyListeners();
    return item;
  }

  /// Saves changes to a listing. [media] is the whole gallery in order; new picks are uploaded first.
  Future<ThriftItem> updateItem(
    ThriftItem item, {
    required String title,
    required double priceZar,
    required String condition,
    required String size,
    required String category,
    String description = '',
    String caption = '',
    int quantity = 1,
    required List<ListingMedia> media,
    void Function(int uploaded, int total)? onProgress,
  }) async {
    final toUpload = media.where((m) => m.pending != null).length;
    var uploaded = 0;
    final keys = <String>[];
    for (final m in media) {
      if (m.pending == null) {
        keys.add(m.existingKey!);
        continue;
      }
      onProgress?.call(uploaded, toUpload);
      keys.add(await _call(() => _api.uploadMedia(m.pending!.bytes, m.pending!.contentType)));
      uploaded++;
    }
    onProgress?.call(uploaded, toUpload);
    final res = await _call(() => _api.patch('/api/items/${item.id}', {
          'title': title,
          'priceZar': priceZar,
          'condition': condition,
          'size': size,
          'category': category,
          'description': description,
          'caption': caption,
          'quantity': quantity,
          'media': [for (final k in keys) {'key': k}],
        }));
    final updated = ThriftItem.fromJson(res['item'] as Map<String, dynamic>);
    _replaceItem(updated);
    if (_livePinnedItem?.id == updated.id) _livePinnedItem = updated;
    return updated;
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
    if (item != null) _replaceItem(item.copyWith(commentsCount: item.commentsCount + 1));
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
    String? offerId,
  }) async {
    final res = await _call(() => _api.post('/api/orders', {
          'itemId': item.id,
          'deliveryMethod': deliveryMethod,
          'paymentMethod': paymentMethod,
          'deliveryAddress': deliveryAddress,
          'offerId': ?offerId,
        }));
    final order = EscrowOrder.fromJson(res['order'] as Map<String, dynamic>);
    _orders = [order, ..._orders];
    if (item.quantity <= 1) {
      _feed = _feed.where((i) => i.id != item.id).toList();
    } else {
      loadFeed().catchError((_) {});
    }
    _cart = _cart.where((i) => i.id != item.id).toList();
    notifyListeners();
    loadWallet().catchError((_) {});
    if (offerId != null) loadOffers().catchError((_) {});
    return order;
  }

  /// [trackingNumber] is required unless the order is collected at the Safe Hub.
  Future<void> dispatchOrder(String orderId, {String? trackingNumber}) =>
      _orderAction(orderId, 'dispatch', trackingNumber == null ? null : {'trackingNumber': trackingNumber});
  Future<void> confirmOrder(String orderId) => _orderAction(orderId, 'confirm');
  Future<void> disputeOrder(String orderId) => _orderAction(orderId, 'dispute');

  Future<void> _orderAction(String orderId, String action, [Object? body]) async {
    final res = await _call(() => _api.post('/api/orders/$orderId/$action', body));
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

  // ---- Cart ----

  void _applyCart(dynamic res) {
    _cart = (res['items'] as List).map((i) {
      final json = i as Map<String, dynamic>;
      // Sold or removed pieces stay in the list, shown as no longer available.
      return ThriftItem.fromJson({...json, 'isClaimed': json['available'] == false || json['isClaimed'] == true});
    }).toList();
  }

  Future<void> loadCart() async {
    _applyCart(await _call(() => _api.get('/api/cart')));
    notifyListeners();
  }

  Future<void> addToCart(ThriftItem item) async {
    _applyCart(await _call(() => _api.post('/api/cart/${item.id}')));
    _markInCart(item.id, true);
    notifyListeners();
  }

  Future<void> removeFromCart(String itemId) async {
    _applyCart(await _call(() => _api.delete('/api/cart/$itemId')));
    _markInCart(itemId, false);
    notifyListeners();
  }

  /// Buys everything in the cart; returns the error for each piece that could not be bought.
  Future<List<String>> checkoutCart({
    required String deliveryMethod,
    required String paymentMethod,
    required String deliveryAddress,
  }) async {
    dynamic res;
    try {
      res = await _call(() => _api.post('/api/cart/checkout', {
            'deliveryMethod': deliveryMethod,
            'paymentMethod': paymentMethod,
            'deliveryAddress': deliveryAddress,
          }));
    } on ApiException {
      // Nothing could be bought; reload so the cart shows which pieces are gone.
      await loadCart().catchError((_) {});
      rethrow;
    }
    final bought = (res['orders'] as List).map((o) => EscrowOrder.fromJson(o as Map<String, dynamic>)).toList();
    _orders = [...bought, ..._orders];
    notifyListeners();
    // Pieces with stock left stay in the feed, so reload it rather than dropping what was bought.
    await Future.wait([loadCart(), loadWallet(), loadFeed()].map((f) => f.catchError((_) {})));
    return [for (final f in res['failed'] as List) (f as Map<String, dynamic>)['error'] as String];
  }

  // ---- Offers ----

  Future<void> loadOffers() async {
    final res = await _call(() => _api.get('/api/offers'));
    _offers = (res['offers'] as List).map((o) => Offer.fromJson(o as Map<String, dynamic>)).toList();
    notifyListeners();
  }

  Future<void> makeOffer(ThriftItem item, double amountZar) async {
    await _call(() => _api.post('/api/items/${item.id}/offers', {'amountZar': amountZar}));
    await loadOffers();
  }

  /// [action] is accept, decline, counter (with [amountZar]) or cancel.
  Future<void> respondToOffer(String offerId, String action, {double? amountZar}) async {
    await _call(() => _api.post('/api/offers/$offerId/$action', amountZar == null ? null : {'amountZar': amountZar}));
    await loadOffers();
  }

  // ---- Sellers, follows and reviews ----

  Future<(SellerProfile, List<ThriftItem>, List<Review>)> loadProfile(String userId) async {
    final res = await _call(() => _api.get('/api/users/$userId'));
    return (
      SellerProfile.fromJson(res['profile'] as Map<String, dynamic>),
      _items(res),
      [for (final r in res['reviews'] as List) Review.fromJson(r as Map<String, dynamic>)],
    );
  }

  Future<SellerProfile> setFollowing(String userId, bool follow) async {
    final res = await _call(() => follow ? _api.post('/api/users/$userId/follow') : _api.delete('/api/users/$userId/follow'));
    loadMyFollowCounts().catchError((_) {});
    return SellerProfile.fromJson(res['profile'] as Map<String, dynamic>);
  }

  Future<void> loadMyFollowCounts() async {
    if (_user == null) return;
    final (me, _, _) = await loadProfile(_user!.id);
    _followers = me.followerCount;
    _following = me.followingCount;
    notifyListeners();
  }

  /// [which] is 'followers' or 'following'.
  Future<List<PersonRow>> loadFollowList(String userId, String which) async {
    final res = await _call(() => _api.get('/api/users/$userId/$which'));
    return [for (final u in res['users'] as List) PersonRow.fromJson(u as Map<String, dynamic>)];
  }

  Future<List<PersonRow>> searchPeople(String query) async {
    if (query.trim().length < 2) return const [];
    final res = await _call(() => _api.get('/api/users', {'q': query.trim()}));
    return [for (final u in res['users'] as List) PersonRow.fromJson(u as Map<String, dynamic>)];
  }

  Future<void> reviewOrder(String orderId, int rating, String text) async {
    await _call(() => _api.post('/api/orders/$orderId/review', {'rating': rating, 'text': text}));
    await loadOrders();
  }

  // ---- Chat ----

  Future<List<ChatSummary>> loadChats() async {
    final res = await _call(() => _api.get('/api/chats'));
    return [for (final c in res['chats'] as List) ChatSummary.fromJson(c as Map<String, dynamic>)];
  }

  /// The conversation with [userId]; opening it marks their messages read.
  Future<List<ChatMessage>> loadChat(String userId) async {
    final res = await _call(() => _api.get('/api/chats/$userId'));
    final messages = [for (final m in res['messages'] as List) ChatMessage.fromJson(m as Map<String, dynamic>)];
    pollNotifications();
    return messages;
  }

  Future<void> sendMessage(String userId, String text, {String? itemId}) async {
    await _call(() => _api.post('/api/chats/$userId', {'text': text, 'itemId': ?itemId}));
  }

  // ---- Support ----

  /// Sends a question to Dobha support. Works signed out too (then [email] is needed for the answer).
  Future<void> contactSupport({required String topic, required String message, String? orderId, String? email}) =>
      _call(() => _api.post('/api/support', {'topic': topic, 'message': message, 'orderId': ?orderId, 'email': ?email}));

  Future<List<SupportRequest>> loadSupportRequests() async {
    final res = await _call(() => _api.get('/api/support'));
    return [for (final r in res['requests'] as List) SupportRequest.fromJson(r as Map<String, dynamic>)];
  }
}
