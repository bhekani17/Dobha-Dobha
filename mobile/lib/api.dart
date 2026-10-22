import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

const deploymentApiBaseUrl = String.fromEnvironment('API_BASE_URL');
const deploymentStage = String.fromEnvironment('DEPLOYMENT_STAGE');

String defaultServerUrl() {
  if (deploymentApiBaseUrl.isNotEmpty) return deploymentApiBaseUrl;
  if (kIsWeb) return Uri.base.origin;
  throw StateError(
    'Set API_BASE_URL and DEPLOYMENT_STAGE when building or running the mobile app.',
  );
}

void validateDeploymentApi() {
  if (deploymentApiBaseUrl.isEmpty) return;
  if (!['dev', 'prod'].contains(deploymentStage)) {
    throw StateError('DEPLOYMENT_STAGE must be "dev" or "prod".');
  }
  final apiUrl = Uri.tryParse(deploymentApiBaseUrl);
  if (apiUrl == null ||
      !apiUrl.hasAuthority ||
      !['http', 'https'].contains(apiUrl.scheme)) {
    throw StateError('API_BASE_URL must be an absolute HTTP or HTTPS URL.');
  }
  if (deploymentStage == 'prod' &&
      (apiUrl.scheme != 'https' || apiUrl.pathSegments.contains('dev'))) {
    throw StateError(
      'Production builds require an HTTPS API URL that is not the dev stage.',
    );
  }
}

/// A failed request, with the server's message ready to show to the user.
class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);

  bool get isUnauthorized => status == 401;

  @override
  String toString() => message;
}

class LiveRoom {
  final String name;
  final int viewers;

  /// Who is hosting, when the server could tell (shown on Home's live row).
  final String? hostId;
  final String? hostName;
  final String? hostAvatarUrl;

  LiveRoom(this.name, this.viewers, {this.hostId, this.hostName, this.hostAvatarUrl});

  factory LiveRoom.fromJson(Map<String, dynamic> json) {
    final host = json['host'] as Map<String, dynamic>?;
    return LiveRoom(
      json['name'] as String,
      json['viewers'] as int? ?? 0,
      hostId: host?['id'] as String?,
      hostName: host?['name'] as String?,
      hostAvatarUrl: host?['avatarUrl'] as String?,
    );
  }
}

class JoinInfo {
  final String url;
  final String token;
  JoinInfo(this.url, this.token);
}

class Api {
  final String baseUrl;
  String? token;

  Api(String baseUrl, {this.token}) : baseUrl = baseUrl.replaceAll(RegExp(r'/+$'), '');

  /// Absolute URL for a server path such as `/media/...`.
  String resolve(String path) => path.startsWith('http') ? path : '$baseUrl$path';

  Future<dynamic> get(String path, [Map<String, String>? query]) => _send('GET', path, query: query);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body: body);
  Future<dynamic> patch(String path, Object body) => _send('PATCH', path, body: body);
  Future<dynamic> delete(String path, [Object? body]) => _send('DELETE', path, body: body);

  /// PUT raw bytes (e.g. a profile picture).
  Future<dynamic> putBytes(String path, Uint8List bytes, String contentType) =>
      _send('PUT', path, raw: bytes, contentType: contentType, timeout: const Duration(minutes: 2));

  /// Uploads a photo or video and returns the storage key to attach to an item.
  Future<String> uploadMedia(Uint8List bytes, String contentType) async {
    final request = await post('/api/uploads', {'contentType': contentType, 'size': bytes.length}) as Map<String, dynamic>;
    final key = request['key'] as String;
    final uploadUrl = request['uploadUrl'] as String;
    final http.Response response;
    try {
      response = await http
          .put(Uri.parse(uploadUrl), headers: {'content-type': contentType}, body: bytes)
          .timeout(const Duration(minutes: 5));
    } on TimeoutException {
      throw ApiException(0, 'Media upload timed out. Please try again.');
    } on http.ClientException {
      throw ApiException(0, 'Media upload failed. Check your internet and try again.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(response.statusCode, 'Media upload failed (${response.statusCode})');
    }
    return key;
  }

  Future<List<LiveRoom>> rooms() async {
    final data = await get('/api/rooms') as List;
    return data.map((r) => LiveRoom.fromJson(r as Map<String, dynamic>)).toList();
  }

  Future<JoinInfo> liveToken({required String room, required bool host}) async {
    final data = await get('/api/token', {'room': room, 'role': host ? 'host' : 'viewer'}) as Map<String, dynamic>;
    return JoinInfo(data['url'] as String, data['token'] as String);
  }

  // ---- Stories ----

  Future<dynamic> getStories() => get('/api/stories');

  Future<dynamic> postStory({required String mediaUrl, required String mediaType, String caption = ''}) =>
      post('/api/stories', {'mediaUrl': mediaUrl, 'mediaType': mediaType, 'caption': caption});

  // ---- Subscriptions ----

  Future<dynamic> toggleSubscription(String userId) => post('/api/users/$userId/subscribe');

  Future<dynamic> getSubscriptions() => get('/api/subscriptions');

  // ---- Promotions (boost) ----

  /// Promotes [itemId] for [days] days at [tier]: 'basic', 'standard', or 'premium'.
  Future<dynamic> promoteItem(String itemId, {required int days, String tier = 'basic'}) =>
      post('/api/items/$itemId/promote', {'days': days, 'tier': tier});

  Future<dynamic> _send(
    String method,
    String path, {
    Map<String, String>? query,
    Object? body,
    Uint8List? raw,
    String? contentType,
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final req = http.Request(method, Uri.parse('$baseUrl$path').replace(queryParameters: query));
    if (token != null) req.headers['authorization'] = 'Bearer $token';
    if (raw != null) {
      req.headers['content-type'] = contentType ?? 'application/octet-stream';
      req.bodyBytes = raw;
    } else if (body != null) {
      req.headers['content-type'] = 'application/json';
      req.body = jsonEncode(body);
    }

    final http.Response res;
    try {
      res = await http.Response.fromStream(await req.send().timeout(timeout));
    } catch (_) {
      throw ApiException(0, 'No connection. Check your internet and try again.');
    }

    dynamic data;
    try {
      data = res.body.isEmpty ? null : jsonDecode(res.body);
    } catch (_) {
      data = null;
    }
    if (res.statusCode >= 400) {
      final msg = data is Map && data['error'] is String ? data['error'] as String : 'Request failed (${res.statusCode})';
      throw ApiException(res.statusCode, msg);
    }
    return data;
  }
}
