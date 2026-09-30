import 'package:flutter/material.dart';

import 'screens/main_shell.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const DobhaLiveApp());
}

class DobhaLiveApp extends StatelessWidget {
  const DobhaLiveApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Dobha Dobha - Street Thrift & Live Escrow',
      debugShowCheckedModeBanner: false,
      theme: dobhaTheme(),
      home: const MainShell(),
    );
  }
}
