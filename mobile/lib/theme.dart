import 'package:flutter/material.dart';

class DobhaColors {
  // Flat: the page, raised surfaces on it, and recessed wells, told apart by tone only.
  static const bg = Color(0xFF15171B);
  static const surface = Color(0xFF22252B);
  static const well = Color(0xFF1A1D22);
  static const card = surface;
  static const cardElevated = Color(0xFF2B2F36);

  static const green = Color(0xFF00E676);
  static const greenDark = Color(0xFF00A34D);
  static const text = Color(0xFFF2F3F5);
  static const textSecondary = Color(0xFFB4B8C0);
  static const muted = Color(0xFF7C818B);
  static const red = Color(0xFFFF4D67);
  static const border = Color(0xFF2A2E35);
  static const borderLight = Color(0xFF33373F);

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
  final fieldBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: BorderSide.none,
  );
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: DobhaColors.bg,
    canvasColor: DobhaColors.bg,
    splashFactory: NoSplash.splashFactory,
    // Flat: Material surfaces never cast shadows or get tinted by elevation.
    shadowColor: Colors.transparent,
    colorScheme: const ColorScheme.dark(
      primary: DobhaColors.green,
      onPrimary: Colors.black,
      surface: DobhaColors.bg,
      onSurface: DobhaColors.text,
      error: DobhaColors.red,
    ),
    // Fields are flat, filled with the surface tone.
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: DobhaColors.surface,
      isDense: true,
      hintStyle: const TextStyle(color: DobhaColors.muted),
      labelStyle: const TextStyle(color: DobhaColors.muted),
      border: fieldBorder,
      enabledBorder: fieldBorder,
      focusedBorder: fieldBorder.copyWith(
        borderSide: BorderSide(color: DobhaColors.green.withValues(alpha: 0.6), width: 1.2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: DobhaColors.green,
        foregroundColor: Colors.black,
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        shape: shape,
        elevation: 0,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: DobhaColors.text,
        backgroundColor: DobhaColors.cardElevated,
        side: BorderSide.none,
        shape: shape,
        padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 16),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: DobhaColors.green, shape: shape),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: DobhaColors.bg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      scrolledUnderElevation: 0,
      titleTextStyle: TextStyle(
        fontSize: 19,
        fontWeight: FontWeight.w800,
        color: DobhaColors.text,
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: DobhaColors.bg,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: DobhaColors.surface,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: DobhaColors.cardElevated,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      elevation: 0,
      backgroundColor: DobhaColors.cardElevated,
      contentTextStyle: const TextStyle(color: DobhaColors.text, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    dividerTheme: const DividerThemeData(color: DobhaColors.border, thickness: 1),
    tabBarTheme: const TabBarThemeData(dividerColor: Colors.transparent),
  );
}
