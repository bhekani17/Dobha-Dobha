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
        final isFeed = _currentIndex == 0;

        return Scaffold(
          body: IndexedStack(
            index: _currentIndex,
            children: _screens,
          ),
          bottomNavigationBar: Container(
            decoration: BoxDecoration(
              color: isFeed ? Colors.black.withValues(alpha: 0.95) : DobhaColors.card,
              border: const Border(
                top: BorderSide(color: DobhaColors.border, width: 1),
              ),
            ),
            child: SafeArea(
              child: NavigationBar(
                selectedIndex: _currentIndex,
                onDestinationSelected: (idx) {
                  HapticFeedback.selectionClick();
                  setState(() => _currentIndex = idx);
                },
                backgroundColor: Colors.transparent,
                indicatorColor: DobhaColors.green.withValues(alpha: 0.2),
                height: 64,
                labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
                destinations: [
                  const NavigationDestination(
                    icon: Icon(Icons.flash_on_outlined),
                    selectedIcon: Icon(Icons.flash_on, color: DobhaColors.green),
                    label: 'Digital Dobha',
                  ),
                  const NavigationDestination(
                    icon: Icon(Icons.explore_outlined),
                    selectedIcon: Icon(Icons.explore, color: DobhaColors.green),
                    label: 'Explore',
                  ),
                  NavigationDestination(
                    icon: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: DobhaColors.red.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: DobhaColors.red.withValues(alpha: 0.5)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.sensors_rounded, size: 14, color: DobhaColors.red),
                          SizedBox(width: 4),
                          Text('LIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: DobhaColors.red)),
                        ],
                      ),
                    ),
                    selectedIcon: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: DobhaColors.red,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.sensors_rounded, size: 14, color: Colors.white),
                          SizedBox(width: 4),
                          Text('LIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white)),
                        ],
                      ),
                    ),
                    label: 'Go Live',
                  ),
                  NavigationDestination(
                    icon: const Icon(Icons.shield_outlined),
                    selectedIcon: const Icon(Icons.shield_rounded, color: DobhaColors.cyan),
                    label: 'Escrow',
                  ),
                  const NavigationDestination(
                    icon: Icon(Icons.person_outline_rounded),
                    selectedIcon: Icon(Icons.person_rounded, color: DobhaColors.green),
                    label: 'Profile',
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
