import 'package:flutter/material.dart';

class DobhaColors {
  static const bg = Color(0xFF000000);
  static const card = Color(0xFF111111);
  static const green = Color(0xFF00C264);
  static const text = Color(0xFFFFFFFF);
  static const muted = Color(0xFF888888);
  static const red = Color(0xFFFF3B3B);
  static const border = Color(0xFF222222);
}

ThemeData dobhaTheme() {
  final border = OutlineInputBorder(
    borderRadius: BorderRadius.circular(8),
    borderSide: const BorderSide(color: DobhaColors.border),
  );
  return ThemeData(
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
      fillColor: DobhaColors.bg,
      isDense: true,
      hintStyle: const TextStyle(color: DobhaColors.muted),
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(borderSide: const BorderSide(color: DobhaColors.green)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: DobhaColors.text,
        side: const BorderSide(color: DobhaColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
  );
}
