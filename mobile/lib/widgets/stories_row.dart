import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../models/social.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'user_avatar.dart';
import 'ui.dart';

/// Horizontal scrolling row of story rings shown above the feed.
class StoriesRow extends StatelessWidget {
  const StoriesRow({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final groups = AppState().stories;
        if (groups.isEmpty) return const SizedBox.shrink();

        return SizedBox(
          height: 88,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: groups.length,
            itemBuilder: (context, i) => _StoryRing(group: groups[i]),
          ),
        );
      },
    );
  }
}

/// One avatar ring in the stories row.
class _StoryRing extends StatelessWidget {
  final StoryGroup group;
  const _StoryRing({required this.group});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        StoryViewer.open(context, group: group);
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Gradient ring
            Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [DobhaColors.green, DobhaColors.amber],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              padding: const EdgeInsets.all(2.5),
              child: Container(
                decoration: BoxDecoration(shape: BoxShape.circle, color: DobhaColors.bg),
                padding: const EdgeInsets.all(2),
                child: UserAvatar(url: group.userAvatarUrl, name: group.userName, size: 46),
              ),
            ),
            const SizedBox(height: 5),
            SizedBox(
              width: 64,
              child: Text(
                group.userName,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11, color: DobhaColors.textSecondary, fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Full-screen story viewer — progress bar, swipe-left/right between stories.
class StoryViewer extends StatefulWidget {
  final StoryGroup group;
  const StoryViewer({super.key, required this.group});

  static Future<void> open(BuildContext context, {required StoryGroup group}) {
    return Navigator.of(context).push(PageRouteBuilder(
      opaque: false,
      barrierColor: Colors.black87,
      transitionDuration: const Duration(milliseconds: 260),
      pageBuilder: (_, _, _) => StoryViewer(group: group),
      transitionsBuilder: (_, anim, _, child) => FadeTransition(opacity: anim, child: child),
    ));
  }

  @override
  State<StoryViewer> createState() => _StoryViewerState();
}

class _StoryViewerState extends State<StoryViewer> with SingleTickerProviderStateMixin {
  int _index = 0;
  late AnimationController _ctrl;
  static const _dur = Duration(seconds: 5);

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: _dur)
      ..addStatusListener((s) {
        if (s == AnimationStatus.completed) _advance();
      })
      ..forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _advance() {
    if (_index < widget.group.stories.length - 1) {
      setState(() => _index++);
      _ctrl
        ..reset()
        ..forward();
    } else {
      Navigator.of(context).pop();
    }
  }

  void _retreat() {
    if (_index > 0) {
      setState(() => _index--);
      _ctrl
        ..reset()
        ..forward();
    }
  }

  Story get _story => widget.group.stories[_index];

  @override
  Widget build(BuildContext context) {
    final story = _story;
    final resolvedUrl = AppState().api.resolve(story.mediaUrl);

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background media
          story.isVideo
              ? const ColoredBox(
                  color: Colors.black,
                  child: Center(
                    child: Icon(Icons.play_circle_outline_rounded, color: Colors.white, size: 72),
                  ),
                )
              : Image.network(
                  resolvedUrl,
                  fit: BoxFit.cover,
                  loadingBuilder: (_, child, progress) => progress == null
                      ? child
                      : const Center(child: CircularProgressIndicator(color: Colors.white)),
                  errorBuilder: (_, _, _) => const Center(
                    child: Icon(Icons.broken_image_outlined, color: Colors.white54, size: 64),
                  ),
                ),

          // Top-to-center gradient
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment(0, 0.35),
                colors: [Colors.black54, Colors.transparent],
              ),
            ),
          ),

          // Caption
          if (story.caption.isNotEmpty)
            Positioned(
              left: 20,
              right: 20,
              bottom: 80,
              child: Text(
                story.caption,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  shadows: [Shadow(color: Colors.black54, blurRadius: 8)],
                ),
              ),
            ),

          // Tap left / tap right
          Row(
            children: [
              Expanded(child: GestureDetector(onTap: _retreat, behavior: HitTestBehavior.opaque)),
              Expanded(child: GestureDetector(onTap: _advance, behavior: HitTestBehavior.opaque)),
            ],
          ),

          // Header — progress segments + avatar + close
          SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
                  child: Row(
                    children: [
                      for (var i = 0; i < widget.group.stories.length; i++) ...[
                        if (i > 0) const SizedBox(width: 4),
                        Expanded(
                          child: AnimatedBuilder(
                            animation: _ctrl,
                            builder: (_, _) => ClipRRect(
                              borderRadius: BorderRadius.circular(2),
                              child: LinearProgressIndicator(
                                value: i < _index ? 1.0 : i == _index ? _ctrl.value : 0.0,
                                minHeight: 2.5,
                                backgroundColor: Colors.white24,
                                valueColor: const AlwaysStoppedAnimation(Colors.white),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
                  child: Row(
                    children: [
                      UserAvatar(url: story.userAvatarUrl, name: story.userName, size: 36),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(story.userName,
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
                            Text(_ago(story.createdAt),
                                style: const TextStyle(color: Colors.white60, fontSize: 12)),
                          ],
                        ),
                      ),
                      AppButton.icon(
                        icon: Icons.close_rounded,
                        size: 20,
                        padding: 8,
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _ago(DateTime t) {
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 1) return 'Just now';
    if (d.inHours < 1) return '${d.inMinutes}m ago';
    return '${d.inHours}h ago';
  }
}

/// "Add Story" button for vendors in StudioScreen.
class AddStoryButton extends StatefulWidget {
  const AddStoryButton({super.key});

  @override
  State<AddStoryButton> createState() => _AddStoryButtonState();
}

class _AddStoryButtonState extends State<AddStoryButton> {
  bool _busy = false;

  Future<void> _pick() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: DobhaColors.surface,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Add a Story',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
              const SizedBox(height: 4),
              Text('Disappears in 24 hours. Show your latest haul or a new drop.',
                  style: TextStyle(color: DobhaColors.muted, fontSize: 13)),
              const SizedBox(height: 16),
              AppButton(
                onPressed: () => Navigator.of(ctx).pop('gallery'),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.photo_library_outlined, size: 18),
                  SizedBox(width: 8),
                  Text('Choose from gallery'),
                ]),
              ),
              const SizedBox(height: 10),
              AppButton(
                onPressed: () => Navigator.of(ctx).pop('camera'),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.camera_alt_outlined, size: 18),
                  SizedBox(width: 8),
                  Text('Take a photo'),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
    if (choice == null || !mounted) return;

    try {
      final picker = ImagePicker();
      final file = choice == 'camera'
          ? await picker.pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 85)
          : await picker.pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 85);
      if (file == null || !mounted) return;

      final bytes = await file.readAsBytes();
      final contentType = file.mimeType ?? 'image/jpeg';
      setState(() => _busy = true);
      await AppState().createStory(bytes, contentType);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Story posted! It disappears in 24 hours.')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Could not open photos. Check app permissions.')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppButton(
      onPressed: _busy ? null : _pick,
      radius: 16,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: _busy
          ? SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2.2, color: DobhaColors.green),
            )
          : const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.add_circle_outline_rounded, size: 18),
                SizedBox(width: 8),
                Text('Add a Story'),
              ],
            ),
    );
  }
}
