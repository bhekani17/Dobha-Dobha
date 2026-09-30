import 'dart:math' as math;
import 'package:flutter/material.dart';

import '../theme.dart';

/// Reaction kinds sent over the data channel. Rendered as icons, never emoji.
enum Reaction {
  heart(Icons.favorite_rounded),
  fire(Icons.local_fire_department_rounded),
  celebrate(Icons.celebration_rounded);

  final IconData icon;
  const Reaction(this.icon);

  Color get color => switch (this) {
        Reaction.heart => DobhaColors.green,
        Reaction.fire => Colors.white,
        Reaction.celebrate => DobhaColors.green,
      };

  static Reaction fromName(String? name) =>
      Reaction.values.firstWhere((r) => r.name == name, orElse: () => Reaction.heart);
}

class FloatingReactionsController extends ChangeNotifier {
  final List<ReactionParticle> particles = [];

  void addReaction([Reaction reaction = Reaction.heart]) {
    final particle = ReactionParticle(
      id: UniqueKey().toString(),
      reaction: reaction,
      startX: 0.65 + math.Random().nextDouble() * 0.25, // float along right side
      wobbleSeed: math.Random().nextDouble() * 2 * math.pi,
      speed: 0.8 + math.Random().nextDouble() * 0.4,
    );
    particles.add(particle);
    notifyListeners();
  }

  void remove(String id) {
    particles.removeWhere((p) => p.id == id);
  }
}

class ReactionParticle {
  final String id;
  final Reaction reaction;
  final double startX;
  final double wobbleSeed;
  final double speed;

  ReactionParticle({
    required this.id,
    required this.reaction,
    required this.startX,
    required this.wobbleSeed,
    required this.speed,
  });
}

class FloatingReactionsLayer extends StatefulWidget {
  final FloatingReactionsController controller;

  const FloatingReactionsLayer({super.key, required this.controller});

  @override
  State<FloatingReactionsLayer> createState() => _FloatingReactionsLayerState();
}

class _FloatingReactionsLayerState extends State<FloatingReactionsLayer> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: [
          for (final p in widget.controller.particles)
            _AnimatedParticle(
              key: ValueKey(p.id),
              particle: p,
              onComplete: () => widget.controller.remove(p.id),
            ),
        ],
      ),
    );
  }
}

class _AnimatedParticle extends StatefulWidget {
  final ReactionParticle particle;
  final VoidCallback onComplete;

  const _AnimatedParticle({super.key, required this.particle, required this.onComplete});

  @override
  State<_AnimatedParticle> createState() => _AnimatedParticleState();
}

class _AnimatedParticleState extends State<_AnimatedParticle> with SingleTickerProviderStateMixin {
  late final AnimationController _anim;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: (2000 / widget.particle.speed).round()),
    )..forward().then((_) => widget.onComplete());
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (context, child) {
        final progress = _anim.value;
        // Float from bottom (1.0) up to near top (0.1)
        final y = 1.0 - (progress * 0.85);
        // Subtle horizontal sinusoidal wobble
        final wobble = math.sin((progress * 4 * math.pi) + widget.particle.wobbleSeed) * 0.05;
        final x = (widget.particle.startX + wobble).clamp(0.05, 0.95);

        final opacity = (1.0 - (progress * 1.1)).clamp(0.0, 1.0);
        final scale = 0.8 + (progress * 0.6);

        return Align(
          alignment: FractionalOffset(x, y),
          child: Opacity(
            opacity: opacity,
            child: Transform.scale(
              scale: scale,
              child: Icon(
                widget.particle.reaction.icon,
                color: widget.particle.reaction.color,
                size: 34,
              ),
            ),
          ),
        );
      },
    );
  }
}
