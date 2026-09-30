import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// Base URL of the Dobha server (`server/`).
///
/// Pass `--dart-define=SERVER_URL=https://<your-worker>` for phone builds.
/// On web the Worker serves the app and the API from one origin.
String defaultServerUrl() {
  const fromEnv = String.fromEnvironment('SERVER_URL');
  if (fromEnv.isNotEmpty) return fromEnv;
  if (kIsWeb) return Uri.base.origin;
  if (kReleaseMode) {
    throw StateError('Build with --dart-define=SERVER_URL=https://<your-server>');
  }
  return Platform.isAndroid ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
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
  LiveRoom(this.name, this.viewers);
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
  Future<dynamic> delete(String path) => _send('DELETE', path);

  /// Uploads a photo or video and returns the storage key to attach to an item.
  Future<String> uploadMedia(Uint8List bytes, String contentType) async {
    final res = await _send('POST', '/api/uploads',
        raw: bytes, contentType: contentType, timeout: const Duration(minutes: 5));
    return res['key'] as String;
  }

  Future<List<LiveRoom>> rooms() async {
    final data = await get('/api/rooms') as List;
    return data.map((r) => LiveRoom(r['name'] as String, r['viewers'] as int)).toList();
  }

  Future<JoinInfo> liveToken({required String room, required bool host}) async {
    final data = await get('/api/token', {'room': room, 'role': host ? 'host' : 'viewer'}) as Map<String, dynamic>;
    return JoinInfo(data['url'] as String, data['token'] as String);
  }

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
