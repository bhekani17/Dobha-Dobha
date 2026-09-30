import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'item_photo.dart';
import 'ui.dart';

/// A listing's photos and videos, full bleed, swiped sideways.
/// Videos loop and play only while their page is visible; sound starts off.
class MediaCarousel extends StatefulWidget {
  final ThriftItem item;

  /// Whether this listing is the one on screen in the feed.
  final bool active;

  const MediaCarousel({super.key, required this.item, required this.active});

  /// Shared across the feed so unmuting once keeps sound on while scrolling.
  static final muted = ValueNotifier(true);

  @override
  State<MediaCarousel> createState() => _MediaCarouselState();
}

class _MediaCarouselState extends State<MediaCarousel> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final media = widget.item.media;
    if (media.isEmpty) return ItemPhoto(item: widget.item, iconSize: 96);

    // Hidden tabs and covered routes turn tickers off; treat that as "not visible".
    final visible = widget.active && TickerMode.valuesOf(context).enabled;

    return Stack(
      fit: StackFit.expand,
      children: [
        PageView.builder(
          itemCount: media.length,
          onPageChanged: (i) => setState(() => _page = i),
          itemBuilder: (context, i) {
            final m = media[i];
            final url = AppState().api.resolve(m.url);
            return m.isVideo
                ? _VideoPage(url: url, playing: visible && i == _page)
                : Image.network(
                    url,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => ItemPhoto(item: widget.item, iconSize: 96),
                    loadingBuilder: (context, child, progress) => progress == null
                        ? child
                        : const ColoredBox(
                            color: DobhaColors.well,
                            child: Center(child: CircularProgressIndicator(color: DobhaColors.green, strokeWidth: 2)),
                          ),
                  );
          },
        ),
        if (media.length > 1)
          Positioned(
            top: MediaQuery.of(context).padding.top + 64,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < media.length; i++)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: i == _page ? 18 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: i == _page ? Colors.white : Colors.white.withValues(alpha: 0.45),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                ],
              ),
            ),
          ),
        if (media[_page].isVideo)
          Positioned(
            top: MediaQuery.of(context).padding.top + 60,
            right: 12,
            child: ValueListenableBuilder<bool>(
              valueListenable: MediaCarousel.muted,
              builder: (context, muted, _) => OverlayIconButton(
                icon: muted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                size: 20,
                tooltip: muted ? 'Sound on' : 'Sound off',
                onTap: () => MediaCarousel.muted.value = !muted,
              ),
            ),
          ),
      ],
    );
  }
}

class _VideoPage extends StatefulWidget {
  final String url;
  final bool playing;

  const _VideoPage({required this.url, required this.playing});

  @override
  State<_VideoPage> createState() => _VideoPageState();
}

class _VideoPageState extends State<_VideoPage> {
  late final VideoPlayerController _controller = VideoPlayerController.networkUrl(Uri.parse(widget.url));
  bool _ready = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    MediaCarousel.muted.addListener(_applyVolume);
    _controller.initialize().then((_) {
      if (!mounted) return;
      _controller.setLooping(true);
      _applyVolume();
      setState(() => _ready = true);
      _sync();
    }).catchError((_) {
      if (mounted) setState(() => _failed = true);
    });
  }

  @override
  void didUpdateWidget(_VideoPage old) {
    super.didUpdateWidget(old);
    if (old.playing != widget.playing) _sync();
  }

  void _sync() {
    if (!_ready) return;
    widget.playing ? _controller.play() : _controller.pause();
  }

  void _applyVolume() => _controller.setVolume(MediaCarousel.muted.value ? 0 : 1);

  @override
  void dispose() {
    MediaCarousel.muted.removeListener(_applyVolume);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) {
      return const ColoredBox(
        color: DobhaColors.well,
        child: Center(child: Text('Video unavailable', style: TextStyle(color: DobhaColors.muted))),
      );
    }
    if (!_ready) {
      return const ColoredBox(
        color: Colors.black,
        child: Center(child: CircularProgressIndicator(color: DobhaColors.green, strokeWidth: 2)),
      );
    }
    final size = _controller.value.size;
    return GestureDetector(
      // Tap toggles sound; double tap is left to the feed (like).
      onTap: () => MediaCarousel.muted.value = !MediaCarousel.muted.value,
      child: ColoredBox(
        color: Colors.black,
        child: FittedBox(
          fit: BoxFit.cover,
          clipBehavior: Clip.hardEdge,
          child: SizedBox(width: size.width, height: size.height, child: VideoPlayer(_controller)),
        ),
      ),
    );
  }
}
