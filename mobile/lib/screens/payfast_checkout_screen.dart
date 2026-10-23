import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../theme.dart';

class PayFastCheckoutScreen extends StatefulWidget {
  final Map<String, dynamic> fields;

  const PayFastCheckoutScreen({super.key, required this.fields});

  static const _checkoutUrl = 'https://sandbox.payfast.co.za/eng/process';
  static const _websiteHost = 'd3gnsu1yqav87x.cloudfront.net';

  @override
  State<PayFastCheckoutScreen> createState() => _PayFastCheckoutScreenState();
}

class _PayFastCheckoutScreenState extends State<PayFastCheckoutScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null || uri.scheme != 'https') {
              return NavigationDecision.prevent;
            }
            if (uri.host == PayFastCheckoutScreen._websiteHost) {
              Navigator.of(context).pop();
              return NavigationDecision.prevent;
            }
            if (uri.host == 'sandbox.payfast.co.za' ||
                uri.host.endsWith('.sandbox.payfast.co.za')) {
              return NavigationDecision.navigate;
            }
            return NavigationDecision.prevent;
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onWebResourceError: (error) {
            if (error.isForMainFrame != true || !mounted) return;
            setState(() {
              _loading = false;
              _failed = true;
            });
          },
        ),
      )
      ..loadHtmlString(
        _checkoutHtml(widget.fields),
        baseUrl: PayFastCheckoutScreen._checkoutUrl,
      );
  }

  String _escapeAttribute(String value) => value
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll("'", '&#39;');

  String _checkoutHtml(Map<String, dynamic> fields) {
    final inputs = fields.entries
        .map(
          (entry) =>
              '<input type="hidden" name="${_escapeAttribute(entry.key)}" '
              'value="${_escapeAttribute(entry.value.toString())}">',
        )
        .join();
    return '<!doctype html><html><head><meta name="viewport" '
        'content="width=device-width, initial-scale=1"></head><body>'
        '<p>Opening PayFast sandbox checkout…</p>'
        '<form id="checkout" method="post" action="${PayFastCheckoutScreen._checkoutUrl}">'
        '$inputs<button type="submit">Continue to PayFast sandbox</button></form>'
        '<script>document.getElementById("checkout").submit();</script>'
        '</body></html>';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('PayFast sandbox'),
      actions: [
        IconButton(
          tooltip: 'Close checkout',
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.close),
        ),
      ],
    ),
    body: Column(
      children: [
        Container(
          width: double.infinity,
          color: DobhaColors.cardElevated,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: const Text(
            'Sandbox test only. Do not use live payment details. This is not a Dobha wallet deposit or seller payout.',
            style: TextStyle(fontSize: 12),
          ),
        ),
        Expanded(
          child: _failed
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      'Could not open PayFast sandbox checkout. Check your connection, then close this screen and retry from your order.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : Stack(
                  children: [
                    WebViewWidget(controller: _controller),
                    if (_loading)
                      const Center(child: CircularProgressIndicator()),
                  ],
                ),
        ),
      ],
    ),
  );
}
