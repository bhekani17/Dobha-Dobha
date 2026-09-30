import 'package:flutter/material.dart';

/// One set of colours per brightness. The app follows the phone's light/dark
/// setting; [DobhaColors.isDark] is switched by the app root when it changes.
class _Palette {
  final Color bg, surface, well, cardElevated, text, textSecondary, muted, border, borderLight;
  final Color green, red, gold, amber, cyan;

  const _Palette({
    required this.bg,
    required this.surface,
    required this.well,
    required this.cardElevated,
    required this.text,
    required this.textSecondary,
    required this.muted,
    required this.border,
    required this.borderLight,
    required this.green,
    required this.red,
    required this.gold,
    required this.amber,
    required this.cyan,
  });
}

const _dark = _Palette(
  bg: Color(0xFF15171B),
  surface: Color(0xFF22252B),
  well: Color(0xFF1A1D22),
  cardElevated: Color(0xFF2B2F36),
  text: Color(0xFFF2F3F5),
  textSecondary: Color(0xFFB4B8C0),
  muted: Color(0xFF7C818B),
  border: Color(0xFF2A2E35),
  borderLight: Color(0xFF33373F),
  green: Color(0xFF00E676),
  red: Color(0xFFFF4D67),
  gold: Color(0xFFFFB300),
  amber: Color(0xFFF59E0B),
  cyan: Color(0xFF00E5FF),
);

// Light accents are deeper so text in them stays readable on white.
const _light = _Palette(
  bg: Color(0xFFF3F4F6),
  surface: Color(0xFFFFFFFF),
  well: Color(0xFFE9EBEF),
  cardElevated: Color(0xFFE4E7EB),
  text: Color(0xFF15171B),
  textSecondary: Color(0xFF4A4F58),
  muted: Color(0xFF6B7280),
  border: Color(0xFFE2E4E8),
  borderLight: Color(0xFFD5D8DD),
  green: Color(0xFF00A650),
  red: Color(0xFFE5374F),
  gold: Color(0xFFB7791F),
  amber: Color(0xFFD97706),
  cyan: Color(0xFF0891B2),
);

class DobhaColors {
  static bool isDark = true;
  static _Palette get _p => isDark ? _dark : _light;

  // Flat: the page, raised surfaces on it, and recessed wells, told apart by tone only.
  static Color get bg => _p.bg;
  static Color get surface => _p.surface;
  static Color get well => _p.well;
  static Color get card => _p.surface;
  static Color get cardElevated => _p.cardElevated;

  static Color get text => _p.text;
  static Color get textSecondary => _p.textSecondary;
  static Color get muted => _p.muted;
  static Color get border => _p.border;
  static Color get borderLight => _p.borderLight;

  static Color get green => _p.green;
  static const greenDark = Color(0xFF00A34D);
  static Color get red => _p.red;
  static Color get gold => _p.gold;
  static Color get amber => _p.amber;
  static Color get cyan => _p.cyan;
  static const purple = Color(0xFF8B5CF6);

  // Escrow Trust & Safety palette
  static const escrowBlue = Color(0xFF3B82F6);
  static const escrowIndigo = Color(0xFF6366F1);
  static const escrowSuccess = Color(0xFF10B981);

  /// The logo for the current brightness: transparent on dark, black tile on light.
  static String get logoAsset => isDark ? 'assets/images/logo01.png' : 'assets/images/logo.png';
}

ThemeData dobhaTheme(Brightness brightness) {
  // Build with the palette for [brightness], whatever is currently active.
  final previous = DobhaColors.isDark;
  DobhaColors.isDark = brightness == Brightness.dark;
  try {
    return _buildTheme(brightness);
  } finally {
    DobhaColors.isDark = previous;
  }
}

ThemeData _buildTheme(Brightness brightness) {
  final fieldBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: BorderSide.none,
  );
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    scaffoldBackgroundColor: DobhaColors.bg,
    canvasColor: DobhaColors.bg,
    splashFactory: NoSplash.splashFactory,
    // Flat: Material surfaces never cast shadows or get tinted by elevation.
    shadowColor: Colors.transparent,
    colorScheme: ColorScheme.fromSeed(seedColor: DobhaColors.green, brightness: brightness).copyWith(
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
      hintStyle: TextStyle(color: DobhaColors.muted),
      labelStyle: TextStyle(color: DobhaColors.muted),
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
    appBarTheme: AppBarTheme(
      backgroundColor: DobhaColors.bg,
      foregroundColor: DobhaColors.text,
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
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: DobhaColors.bg,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
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
      contentTextStyle: TextStyle(color: DobhaColors.text, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    dividerTheme: DividerThemeData(color: DobhaColors.border, thickness: 1),
    tabBarTheme: const TabBarThemeData(dividerColor: Colors.transparent),
  );
}
