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

  // The middle tab (Go Live) is drawn as a round red button instead of a pill.
  static const _liveIndex = 2;

  static final _tabs = [
    _Tab(Icons.flash_on_outlined, Icons.flash_on, 'Dobha'),
    _Tab(Icons.explore_outlined, Icons.explore, 'Explore'),
    _Tab(Icons.sensors_rounded, Icons.sensors_rounded, 'Go Live'),
    _Tab(Icons.shield_outlined, Icons.shield_rounded, 'Escrow'),
    _Tab(Icons.person_outline_rounded, Icons.person_rounded, 'Profile'),
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
          body: IndexedStack(
            index: _currentIndex,
            // Hidden tabs keep their state but stop animating, so feed videos pause
            // and entrance animations wait until their tab is shown.
            children: [
              for (var i = 0; i < _screens.length; i++) TickerMode(enabled: i == _currentIndex, child: _screens[i]),
            ],
          ),
          bottomNavigationBar: SafeArea(
            minimum: const EdgeInsets.only(bottom: 10),
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 6, 16, 0),
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: DobhaColors.surface,
                borderRadius: BorderRadius.circular(30),
                border: Border.all(color: DobhaColors.borderLight),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  for (var i = 0; i < _tabs.length; i++)
                    if (i == _liveIndex)
                      _LiveButton(selected: _currentIndex == i, onTap: () => _select(i))
                    else
                      _NavItem(
                        tab: _tabs[i],
                        selected: _currentIndex == i,
                        // Unread notifications live behind the bell on the Account tab.
                        badge: i == _tabs.length - 1 && AppState().unreadNotifications > 0,
                        onTap: () => _select(i),
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

/// Icon only when idle; the selected tab grows into a green pill with its label.
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
      label: tab.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          height: 48,
          padding: EdgeInsets.symmetric(horizontal: selected ? 16 : 12),
          decoration: BoxDecoration(
            color: selected ? DobhaColors.green.withValues(alpha: 0.16) : Colors.transparent,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Badge(
                isLabelVisible: badge,
                smallSize: 8,
                backgroundColor: DobhaColors.red,
                child: Icon(selected ? tab.selectedIcon : tab.icon, size: 22, color: color),
              ),
              AnimatedSize(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                child: selected
                    ? Padding(
                        padding: const EdgeInsets.only(left: 8),
                        child: Text(
                          tab.label,
                          maxLines: 1,
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: color),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Go Live: a solid red circle, ringed when its tab is open.
class _LiveButton extends StatelessWidget {
  final bool selected;
  final VoidCallback onTap;

  const _LiveButton({required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: 'Go Live',
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          width: 52,
          height: 52,
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: selected ? DobhaColors.red : Colors.transparent, width: 2),
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(color: DobhaColors.red, shape: BoxShape.circle),
            child: const Icon(Icons.sensors_rounded, size: 24, color: Colors.white),
          ),
        ),
      ),
    );
  }
}
