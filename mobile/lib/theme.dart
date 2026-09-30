import 'package:flutter/material.dart';

class DobhaColors {
  static const bg = Color(0xFF09090B);
  static const card = Color(0xFF141417);
  static const cardElevated = Color(0xFF1E1E24);
  static const green = Color(0xFF00E676);
  static const greenDark = Color(0xFF00A34D);
  static const text = Color(0xFFFFFFFF);
  static const textSecondary = Color(0xFFB0B0B8);
  static const muted = Color(0xFF7A7A85);
  static const red = Color(0xFFFF385C);
  static const border = Color(0xFF27272F);
  static const borderLight = Color(0xFF383842);
  
  // Accents for street thrift culture & grails
  static const gold = Color(0xFFFFB300);
  static const amber = Color(0xFFF59E0B);
  static const cyan = Color(0xFF00E5FF);
  static const purple = Color(0xFF8B5CF6);
  
  // Escrow Trust & Safety palette
  static const escrowBlue = Color(0xFF3B82F6);
  static const escrowIndigo = Color(0xFF6366F1);
  static const escrowSuccess = Color(0xFF10B981);
}

ThemeData dobhaTheme() {
  final border = OutlineInputBorder(
    borderRadius: BorderRadius.circular(10),
    borderSide: const BorderSide(color: DobhaColors.border),
  );
  
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: DobhaColors.bg,
    colorScheme: const ColorScheme.dark(
      primary: DobhaColors.green,
      onPrimary: Colors.black,
      surface: DobhaColors.card,
      onSurface: DobhaColors.text,
      error: DobhaColors.red,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: DobhaColors.card,
      isDense: true,
      hintStyle: const TextStyle(color: DobhaColors.muted),
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
        borderSide: const BorderSide(color: DobhaColors.green, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: DobhaColors.green,
        foregroundColor: Colors.black,
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: DobhaColors.text,
        side: const BorderSide(color: DobhaColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: DobhaColors.bg,
      elevation: 0,
      centerTitle: false,
      scrolledUnderElevation: 0,
      titleTextStyle: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: DobhaColors.text,
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: DobhaColors.card,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
    ),
  );
}
