import 'package:flutter/material.dart';

/// One set of colours per brightness. The app follows the phone's light/dark
/// setting; [DobhaColors.isDark] is switched by the app root when it changes.
///
/// The palette is black, white and green. Red is kept for errors, destructive
/// actions and the live dot; everything else is a shade of grey.
class _Palette {
  final Color bg, surface, well, cardElevated, text, textSecondary, muted, border, borderLight;
  final Color green, red;

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
  });
}

const _dark = _Palette(
  bg: Color(0xFF000000),
  surface: Color(0xFF121212),
  well: Color(0xFF0A0A0A),
  cardElevated: Color(0xFF1F1F1F),
  text: Color(0xFFFFFFFF),
  textSecondary: Color(0xFFBDBDBD),
  muted: Color(0xFF8A8A8A),
  border: Color(0xFF1F1F1F),
  borderLight: Color(0xFF2E2E2E),
  green: Color(0xFF00A93B),
  red: Color(0xFFFF453A),
);

// Green is deeper on white so text in it stays readable.
const _light = _Palette(
  bg: Color(0xFFFFFFFF),
  surface: Color(0xFFF4F4F4),
  well: Color(0xFFEDEDED),
  cardElevated: Color(0xFFE8E8E8),
  text: Color(0xFF000000),
  textSecondary: Color(0xFF3D3D3D),
  muted: Color(0xFF6B6B6B),
  border: Color(0xFFE5E5E5),
  borderLight: Color(0xFFD4D4D4),
  green: Color(0xFF00A650),
  red: Color(0xFFD92D20),
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
  static Color get red => _p.red;

  // Older accent names, folded into the black/white/green palette.
  static Color get gold => _p.green;
  static Color get amber => _p.textSecondary;
  static Color get cyan => _p.text;

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
        fontWeight: FontWeight.w700,
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
    // One gentle transition everywhere instead of each platform's default.
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: _SmoothPageTransitionsBuilder(),
        TargetPlatform.iOS: _SmoothPageTransitionsBuilder(),
        TargetPlatform.windows: _SmoothPageTransitionsBuilder(),
        TargetPlatform.macOS: _SmoothPageTransitionsBuilder(),
        TargetPlatform.linux: _SmoothPageTransitionsBuilder(),
        TargetPlatform.fuchsia: _SmoothPageTransitionsBuilder(),
      },
    ),
  );
}

/// New screens fade in while sliding a short way from the right; the screen underneath
/// dims and drifts slightly left, so going back feels like the reverse.
class _SmoothPageTransitionsBuilder extends PageTransitionsBuilder {
  const _SmoothPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final enter = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);
    final under = CurvedAnimation(parent: secondaryAnimation, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);
    return SlideTransition(
      position: Tween(begin: Offset.zero, end: const Offset(-0.06, 0)).animate(under),
      child: FadeTransition(
        opacity: Tween(begin: 1.0, end: 0.6).animate(under),
        child: SlideTransition(
          position: Tween(begin: const Offset(0.08, 0), end: Offset.zero).animate(enter),
          child: FadeTransition(opacity: enter, child: child),
        ),
      ),
    );
  }
}
