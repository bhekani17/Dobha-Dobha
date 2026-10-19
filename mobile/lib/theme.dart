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
  surface: Color(0xFF101010),
  well: Color(0xFF080808),
  cardElevated: Color(0xFF1C1C1C),
  text: Color(0xFFFFFFFF),
  textSecondary: Color(0xFFC7C7C7),
  muted: Color(0xFF8C8C8C),
  border: Color(0xFF222222),
  borderLight: Color(0xFF2E2E2E),
  green: Color(0xFF00A93B),
  red: Color(0xFFFF453A),
);

// Green is deeper on white so text in it stays readable.
const _light = _Palette(
  bg: Color(0xFFFFFFFF),
  surface: Color(0xFFF7F7F7),
  well: Color(0xFFEFEFEF),
  cardElevated: Color(0xFFEDEDED),
  text: Color(0xFF0A0A0A),
  textSecondary: Color(0xFF3D3D3D),
  muted: Color(0xFF6B6B6B),
  border: Color(0xFFE6E6E6),
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

  /// The app's typeface, bundled in assets/fonts.
  static const fontFamily = 'PlusJakartaSans';

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

/// One type scale for the whole app: big titles are tight and bold, body text is regular.
TextTheme _textTheme() {
  TextStyle s(double size, FontWeight weight, {double height = 1.35, double spacing = 0, Color? color}) =>
      TextStyle(fontSize: size, fontWeight: weight, height: height, letterSpacing: spacing, color: color ?? DobhaColors.text);
  return TextTheme(
    displaySmall: s(32, FontWeight.w700, height: 1.15, spacing: -0.8),
    headlineMedium: s(26, FontWeight.w700, height: 1.2, spacing: -0.6),
    headlineSmall: s(22, FontWeight.w700, height: 1.2, spacing: -0.4),
    titleLarge: s(19, FontWeight.w700, height: 1.25, spacing: -0.3),
    titleMedium: s(16, FontWeight.w600, spacing: -0.1),
    titleSmall: s(14, FontWeight.w600),
    bodyLarge: s(16, FontWeight.w400, height: 1.45),
    bodyMedium: s(14, FontWeight.w400, height: 1.45),
    bodySmall: s(12, FontWeight.w400, color: DobhaColors.muted),
    labelLarge: s(14, FontWeight.w600),
    labelMedium: s(12, FontWeight.w600),
    labelSmall: s(11, FontWeight.w600, spacing: 0.2),
  );
}

ThemeData _buildTheme(Brightness brightness) {
  final fieldBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: BorderSide(color: DobhaColors.border),
  );
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(12));

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    fontFamily: DobhaColors.fontFamily,
    textTheme: _textTheme(),
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
    // Fields are filled with the surface tone and outlined with a hairline.
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: DobhaColors.surface,
      isDense: true,
      hintStyle: TextStyle(color: DobhaColors.muted),
      labelStyle: TextStyle(color: DobhaColors.muted),
      border: fieldBorder,
      enabledBorder: fieldBorder,
      focusedBorder: fieldBorder.copyWith(
        borderSide: BorderSide(color: DobhaColors.green, width: 1.2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: DobhaColors.green,
        foregroundColor: Colors.black,
        textStyle: const TextStyle(fontFamily: DobhaColors.fontFamily, fontWeight: FontWeight.w600, fontSize: 15),
        shape: shape,
        elevation: 0,
        minimumSize: const Size(0, 50),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: DobhaColors.text,
        backgroundColor: DobhaColors.cardElevated,
        textStyle: const TextStyle(fontFamily: DobhaColors.fontFamily, fontWeight: FontWeight.w600, fontSize: 15),
        side: BorderSide.none,
        shape: shape,
        minimumSize: const Size(0, 50),
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
        fontFamily: DobhaColors.fontFamily,
        fontSize: 20,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.4,
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
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: DobhaColors.border)),
    ),
    listTileTheme: ListTileThemeData(
      iconColor: DobhaColors.textSecondary,
      titleTextStyle: TextStyle(fontFamily: DobhaColors.fontFamily, fontSize: 15, fontWeight: FontWeight.w500, color: DobhaColors.text),
      subtitleTextStyle: TextStyle(fontFamily: DobhaColors.fontFamily, fontSize: 13, color: DobhaColors.muted),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: DobhaColors.green),
    popupMenuTheme: PopupMenuThemeData(
      color: DobhaColors.cardElevated,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: DobhaColors.borderLight)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      elevation: 0,
      backgroundColor: DobhaColors.cardElevated,
      contentTextStyle: TextStyle(fontFamily: DobhaColors.fontFamily, color: DobhaColors.text, fontWeight: FontWeight.w500),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: DobhaColors.borderLight)),
    ),
    dividerTheme: DividerThemeData(color: DobhaColors.border, thickness: 1),
    tabBarTheme: TabBarThemeData(
      dividerColor: DobhaColors.border,
      indicator: UnderlineTabIndicator(borderSide: BorderSide(color: DobhaColors.text, width: 2)),
      indicatorSize: TabBarIndicatorSize.tab,
      labelColor: DobhaColors.text,
      unselectedLabelColor: DobhaColors.muted,
      labelStyle: const TextStyle(fontFamily: DobhaColors.fontFamily, fontWeight: FontWeight.w600, fontSize: 14),
      unselectedLabelStyle: const TextStyle(fontFamily: DobhaColors.fontFamily, fontWeight: FontWeight.w500, fontSize: 14),
    ),
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
