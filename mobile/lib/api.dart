import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// Base URL of the token server in `server/`.
///
/// Pass `--dart-define=SERVER_URL=http://<your-pc-ip>:3000` when running on a
/// real phone. Without it, emulators/simulators reach the PC through their
/// usual loopback aliases. Release builds must pass the public https URL.
String defaultServerUrl() {
  const fromEnv = String.fromEnvironment('SERVER_URL');
  if (fromEnv.isNotEmpty) return fromEnv;
  if (kReleaseMode) {
    throw StateError('Build with --dart-define=SERVER_URL=https://<your-server>');
  }
  return Platform.isAndroid ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
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
  Api(String baseUrl) : baseUrl = baseUrl.replaceAll(RegExp(r'/+$'), '');

  Future<List<LiveRoom>> rooms() async {
    final data = await _get('/rooms') as List;
    return data.map((r) => LiveRoom(r['name'] as String, r['viewers'] as int)).toList();
  }

  Future<JoinInfo> token({required String room, required String identity, required bool host}) async {
    final data = await _get('/token', {
      'room': room,
      'identity': identity,
      'role': host ? 'host' : 'viewer',
    }) as Map<String, dynamic>;
    return JoinInfo(data['url'] as String, data['token'] as String);
  }

  Future<dynamic> _get(String path, [Map<String, String>? query]) async {
    final http.Response res;
    try {
      res = await http
          .get(Uri.parse(baseUrl + path).replace(queryParameters: query))
          .timeout(const Duration(seconds: 8));
    } catch (_) {
      throw Exception('Could not reach $baseUrl');
    }
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) {
      throw Exception(body is Map && body['error'] != null ? body['error'] : 'Request failed (${res.statusCode})');
    }
    return body;
  }
}
