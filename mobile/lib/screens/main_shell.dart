import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../state/app_state.dart';
import '../theme.dart';
import 'explore_screen.dart';
import 'feed_screen.dart';
import 'profile_screen.dart';
import 'studio_screen.dart';
import 'wallet_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  static final _tabs = [
    _Tab(Icons.home_outlined, Icons.home_rounded, 'Home'),
    _Tab(Icons.search_rounded, Icons.search_rounded, 'Explore'),
    _Tab(Icons.add_circle_outline_rounded, Icons.add_circle_rounded, 'Sell'),
    _Tab(Icons.receipt_long_outlined, Icons.receipt_long_rounded, 'Orders'),
    _Tab(Icons.person_outline_rounded, Icons.person_rounded, 'Me'),
  ];

  final List<Widget> _screens = const [
    FeedScreen(),
    ExploreScreen(),
    StudioScreen(),
    WalletScreen(),
    ProfileScreen(),
  ];

  void _select(int i) {
    HapticFeedback.selectionClick();
    setState(() => _currentIndex = i);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        return Scaffold(
          // Every tab stays built so it keeps its state; switching crossfades between them.
          // Hidden tabs stop animating (feed videos pause), can't be tapped and are
          // skipped by screen readers.
          body: Stack(
            fit: StackFit.expand,
            children: [
              for (var i = 0; i < _screens.length; i++)
                AnimatedOpacity(
                  opacity: i == _currentIndex ? 1 : 0,
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOut,
                  child: IgnorePointer(
                    ignoring: i != _currentIndex,
                    child: ExcludeSemantics(
                      excluding: i != _currentIndex,
                      child: TickerMode(enabled: i == _currentIndex, child: _screens[i]),
                    ),
                  ),
                ),
            ],
          ),
          bottomNavigationBar: SafeArea(
            minimum: const EdgeInsets.only(bottom: 10),
            child: Container(
              // No bar behind the tabs: they sit straight on the page.
              margin: const EdgeInsets.fromLTRB(8, 6, 8, 0),
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              child: Row(
                children: [
                  for (var i = 0; i < _tabs.length; i++)
                    Expanded(
                      child: _NavItem(
                        tab: _tabs[i],
                        selected: _currentIndex == i,
                        // Unread notifications and messages live on the Me tab.
                        badge: i == _tabs.length - 1 &&
                            (AppState().unreadNotifications > 0 || AppState().unreadMessages > 0),
                        onTap: () => _select(i),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Tab {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  const _Tab(this.icon, this.selectedIcon, this.label);
}

/// Icon with its label underneath; the selected tab is green with a soft pill behind the icon.
class _NavItem extends StatelessWidget {
  final _Tab tab;
  final bool selected;
  final bool badge;
  final VoidCallback onTap;

  const _NavItem({required this.tab, required this.selected, required this.onTap, this.badge = false});

  @override
  Widget build(BuildContext context) {
    final color = selected ? DobhaColors.green : DobhaColors.muted;
    return Semantics(
      button: true,
      selected: selected,
      label: badge ? '${tab.label}, new notifications' : tab.label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOutCubic,
              width: 52,
              height: 30,
              decoration: BoxDecoration(
                color: selected ? DobhaColors.green.withValues(alpha: 0.16) : Colors.transparent,
                borderRadius: BorderRadius.circular(15),
              ),
              child: Badge(
                isLabelVisible: badge,
                smallSize: 8,
                backgroundColor: DobhaColors.red,
                alignment: const AlignmentDirectional(0.45, -0.7),
                child: Center(child: Icon(selected ? tab.selectedIcon : tab.icon, size: 22, color: color)),
              ),
            ),
            const SizedBox(height: 3),
            Text(
              tab.label,
              maxLines: 1,
              style: TextStyle(fontSize: 12, fontWeight: selected ? FontWeight.w600 : FontWeight.w500, color: color),
            ),
          ],
        ),
      ),
    );
  }
}
