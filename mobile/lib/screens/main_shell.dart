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

  static const _tabs = [
    _Tab(Icons.flash_on_outlined, Icons.flash_on, 'Dobha', DobhaColors.green),
    _Tab(Icons.explore_outlined, Icons.explore, 'Explore', DobhaColors.green),
    _Tab(Icons.sensors_rounded, Icons.sensors_rounded, 'Go Live', DobhaColors.red),
    _Tab(Icons.shield_outlined, Icons.shield_rounded, 'Escrow', DobhaColors.cyan),
    _Tab(Icons.person_outline_rounded, Icons.person_rounded, 'Profile', DobhaColors.green),
  ];

  final List<Widget> _screens = const [
    FeedScreen(),
    ExploreScreen(),
    StudioScreen(),
    WalletScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        return Scaffold(
          body: IndexedStack(
            index: _currentIndex,
            children: _screens,
          ),
          bottomNavigationBar: Container(
            decoration: const BoxDecoration(
              color: DobhaColors.surface,
              border: Border(top: BorderSide(color: DobhaColors.border)),
            ),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 10, 10, 8),
                child: Row(
                  children: [
                    for (var i = 0; i < _tabs.length; i++)
                      Expanded(
                        child: _NavItem(
                          tab: _tabs[i],
                          selected: _currentIndex == i,
                          onTap: () {
                            HapticFeedback.selectionClick();
                            setState(() => _currentIndex = i);
                          },
                        ),
                      ),
                  ],
                ),
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
  final Color accent;
  const _Tab(this.icon, this.selectedIcon, this.label, this.accent);
}

class _NavItem extends StatelessWidget {
  final _Tab tab;
  final bool selected;
  final VoidCallback onTap;

  const _NavItem({required this.tab, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            width: 48,
            height: 36,
            decoration: BoxDecoration(
              color: selected ? tab.accent.withValues(alpha: 0.16) : Colors.transparent,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(selected ? tab.selectedIcon : tab.icon, size: 20, color: selected ? tab.accent : DobhaColors.muted),
          ),
          const SizedBox(height: 6),
          Text(
            tab.label,
            maxLines: 1,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              color: selected ? tab.accent : DobhaColors.muted,
            ),
          ),
        ],
      ),
    );
  }
}
