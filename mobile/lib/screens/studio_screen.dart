import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../live_models.dart';
import '../live_screen.dart';
import '../models/thrift_item.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/item_photo.dart';
import '../widgets/ui.dart';
import 'account_sheets.dart';

class StudioScreen extends StatefulWidget {
  const StudioScreen({super.key});

  @override
  State<StudioScreen> createState() => _StudioScreenState();
}

class _StudioScreenState extends State<StudioScreen> {
  final TextEditingController _streamTitleCtrl = TextEditingController();
  bool _isLaunching = false;

  @override
  void dispose() {
    _streamTitleCtrl.dispose();
    super.dispose();
  }

  void _snack(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _goLive() async {
    final appState = AppState();
    final streamName = _streamTitleCtrl.text.trim().isEmpty
        ? appState.user.handle.replaceFirst('@', '')
        : _streamTitleCtrl.text.trim();

    setState(() => _isLaunching = true);
    final pinned = appState.livePinnedItem;
    try {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => LiveScreen(
            api: appState.api,
            roomName: streamName,
            identity: appState.user.name,
            host: true,
            initialPin: pinned == null || pinned.isClaimed
                ? null
                : PinnedItem(id: pinned.id, title: pinned.title, price: pinned.formattedPrice, size: pinned.size),
          ),
        ),
      );
      // Items may have sold during the stream.
      await appState.loadMyItems();
    } catch (e) {
      if (mounted) _snack(e.toString());
    } finally {
      if (mounted) setState(() => _isLaunching = false);
    }
  }

  Future<void> _remove(ThriftItem item) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove listing?'),
        content: Text('"${item.title}" will no longer be shown to shoppers.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: DobhaColors.red, foregroundColor: Colors.white),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await AppState().removeItem(item.id);
    } on ApiException catch (e) {
      if (mounted) _snack(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState(),
      builder: (context, _) {
        final appState = AppState();
        return Scaffold(
          appBar: AppBar(toolbarHeight: 68, title: const Text('Live Studio')),
          body: appState.isVendor ? _vendorBody(appState) : _shopperBody(),
        );
      },
    );
  }

  Widget _shopperBody() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AppWell(
              circle: true,
              padding: EdgeInsets.all(22),
              tint: DobhaColors.red,
              child: Icon(Icons.sensors_rounded, size: 40, color: DobhaColors.red),
            ),
            const SizedBox(height: 20),
            const Text('Sell on Dobha', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text(
              'List pieces from your stall, go live to shoppers across SA, and get paid safely through escrow.',
              textAlign: TextAlign.center,
              style: TextStyle(color: DobhaColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 24),
            AppButton(color: DobhaColors.green, onPressed: () => showBecomeVendorSheet(context), child: const Text('Start Selling')),
          ],
        ),
      ),
    );
  }

  Widget _vendorBody(AppState appState) {
    final user = appState.user;
    final inventory = appState.vendorInventory;
    final pinned = appState.livePinnedItem;

    return RefreshIndicator(
      color: DobhaColors.green,
      backgroundColor: DobhaColors.cardElevated,
      onRefresh: appState.loadMyItems,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          AppCard(
            radius: 24,
            child: Row(
              children: [
                const AppWell(
                  circle: true,
                  padding: EdgeInsets.all(14),
                  tint: DobhaColors.green,
                  child: Icon(Icons.storefront_rounded, color: DobhaColors.green, size: 26),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user.shopName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.location_on_outlined, size: 13, color: DobhaColors.muted),
                          const SizedBox(width: 3),
                          Flexible(child: Text(user.stallLocation, style: const TextStyle(fontSize: 12, color: DobhaColors.textSecondary))),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 26),

          Row(
            children: [
              Expanded(
                child: Text('Your Listings (${inventory.where((i) => !i.isClaimed).length} for sale)',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
              ),
              AppButton(
                radius: 12,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NewListingScreen())),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.add, size: 16, color: DobhaColors.green),
                    SizedBox(width: 4),
                    Text('New Listing', style: TextStyle(color: DobhaColors.green, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text('Tap a listing to pin it when you go live.', style: TextStyle(fontSize: 12, color: DobhaColors.muted)),
          const SizedBox(height: 14),

          if (inventory.isEmpty)
            const AppWell(
              radius: 18,
              padding: EdgeInsets.all(18),
              child: Text('No listings yet. Add your first piece with "New Listing".', style: TextStyle(color: DobhaColors.muted, fontSize: 13)),
            )
          else
            ...inventory.map((item) {
              final isSelected = pinned?.id == item.id;
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: AppButton(
                  selected: isSelected,
                  radius: 18,
                  padding: const EdgeInsets.all(10),
                  onPressed: item.isClaimed ? null : () => isSelected ? appState.unpinLiveItem() : appState.pinItemToLive(item),
                  child: Row(
                    children: [
                      ItemThumb(item: item, size: 50),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: DobhaColors.text)),
                            const SizedBox(height: 2),
                            Text(item.isClaimed ? 'Sold' : (isSelected ? 'Pinned for your next live' : '${item.condition} · Size ${item.size}'),
                                style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: isSelected ? DobhaColors.green : DobhaColors.muted)),
                          ],
                        ),
                      ),
                      Text(item.formattedPrice, style: const TextStyle(fontWeight: FontWeight.w900, color: DobhaColors.green, fontSize: 14)),
                      if (!item.isClaimed)
                        IconButton(
                          icon: const Icon(Icons.delete_outline_rounded, size: 19, color: DobhaColors.muted),
                          onPressed: () => _remove(item),
                        ),
                    ],
                  ),
                ),
              );
            }),
          const SizedBox(height: 22),

          const Text('Stream Name', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 10),
          TextField(
            controller: _streamTitleCtrl,
            decoration: InputDecoration(
              hintText: user.handle.replaceFirst('@', ''),
              prefixIcon: const Icon(Icons.tag, size: 18),
            ),
          ),
          const SizedBox(height: 22),

          AppButton(
            color: DobhaColors.red,
            foreground: Colors.white,
            radius: 18,
            padding: const EdgeInsets.symmetric(vertical: 17),
            onPressed: _isLaunching ? null : _goLive,
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.sensors_rounded, size: 20),
                SizedBox(width: 8),
                Text('GO LIVE NOW', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15, letterSpacing: 0.8)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class NewListingScreen extends StatefulWidget {
  const NewListingScreen({super.key});

  @override
  State<NewListingScreen> createState() => _NewListingScreenState();
}

class _NewListingScreenState extends State<NewListingScreen> {
  final _title = TextEditingController();
  final _price = TextEditingController();
  final _description = TextEditingController();
  final _caption = TextEditingController();
  String _category = ThriftItem.categories.first;
  String _condition = ThriftItem.conditions.first;
  String _size = 'M';
  final _media = <PendingMedia>[];
  bool _busy = false;
  String? _progress;
  String? _error;

  static const _maxMedia = 10;
  static const _maxVideos = 3;
  static const _maxVideoBytes = 60 * 1024 * 1024;

  @override
  void dispose() {
    for (final c in [_title, _price, _description, _caption]) {
      c.dispose();
    }
    super.dispose();
  }

  int get _videoCount => _media.where((m) => m.isVideo).length;

  static String? _typeFor(XFile file, {required bool video}) {
    final name = file.name.toLowerCase();
    final mime = file.mimeType;
    if (mime != null && (mime.startsWith('image/') || mime.startsWith('video/'))) return mime;
    if (video) {
      if (name.endsWith('.mp4')) return 'video/mp4';
      if (name.endsWith('.mov')) return 'video/quicktime';
      if (name.endsWith('.webm')) return 'video/webm';
      return null;
    }
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  Future<void> _addPhotos({required bool camera}) async {
    final room = _maxMedia - _media.length;
    if (room <= 0) return setState(() => _error = 'You can add up to $_maxMedia photos and videos');
    try {
      final picker = ImagePicker();
      final files = camera
          ? [?await picker.pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 82)]
          : await picker.pickMultiImage(maxWidth: 1600, imageQuality: 82, limit: room > 1 ? room : null);
      final added = <PendingMedia>[];
      for (final f in files.take(room)) {
        added.add(PendingMedia(await f.readAsBytes(), _typeFor(f, video: false)!));
      }
      setState(() {
        _media.addAll(added);
        _error = files.length > room ? 'Only the first $room were added (max $_maxMedia)' : null;
      });
    } catch (_) {
      setState(() => _error = 'Could not open photos. Check the app has permission.');
    }
  }

  Future<void> _addVideo(ImageSource source) async {
    if (_media.length >= _maxMedia) return setState(() => _error = 'You can add up to $_maxMedia photos and videos');
    if (_videoCount >= _maxVideos) return setState(() => _error = 'You can add up to $_maxVideos videos');
    try {
      final file = await ImagePicker().pickVideo(source: source, maxDuration: const Duration(seconds: 60));
      if (file == null) return;
      final type = _typeFor(file, video: true);
      if (type == null || !type.startsWith('video/')) {
        return setState(() => _error = 'Use an MP4, MOV or WebM video');
      }
      final bytes = await file.readAsBytes();
      if (bytes.length > _maxVideoBytes) {
        return setState(() => _error = 'That video is too large (max 60 MB). Try a shorter clip.');
      }
      setState(() {
        _media.add(PendingMedia(bytes, type));
        _error = null;
      });
    } catch (_) {
      setState(() => _error = 'Could not open videos. Check the app has permission.');
    }
  }

  void _chooseVideoSource() {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Add a video', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              const Text('Up to 60 seconds. Show the fit, the fabric and any flaws.',
                  style: TextStyle(color: DobhaColors.muted, fontSize: 12.5)),
              const SizedBox(height: 16),
              AppButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  _addVideo(ImageSource.camera);
                },
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.videocam_outlined, size: 18),
                  SizedBox(width: 8),
                  Text('Record'),
                ]),
              ),
              const SizedBox(height: 10),
              AppButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  _addVideo(ImageSource.gallery);
                },
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.video_library_outlined, size: 18),
                  SizedBox(width: 8),
                  Text('Choose from gallery'),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final price = double.tryParse(_price.text.trim().replaceAll(',', '.')) ?? 0;
    if (_title.text.trim().length < 3) return setState(() => _error = 'Give the piece a name (3+ characters)');
    if (price <= 0) return setState(() => _error = 'Enter a price in rand');
    if (!_media.any((m) => !m.isVideo)) return setState(() => _error = 'Add at least one photo; it is the cover shoppers see first');

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppState().createItem(
        title: _title.text.trim(),
        priceZar: price,
        category: _category,
        condition: _condition,
        size: _size,
        description: _description.text.trim(),
        caption: _caption.text.trim(),
        media: _media,
        onProgress: (done, total) {
          if (mounted && total > 0) setState(() => _progress = done < total ? 'Uploading ${done + 1} of $total...' : 'Publishing...');
        },
      );
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _progress = null;
        });
      }
    }
  }

  Widget _mediaTile(int index) {
    final m = _media[index];
    final isCover = !m.isVideo && _media.indexWhere((x) => !x.isVideo) == index;
    return SizedBox(
      width: 104,
      height: 136,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: m.isVideo
                ? const ColoredBox(
                    color: Colors.black,
                    child: Center(child: Icon(Icons.play_circle_outline_rounded, color: Colors.white, size: 36)),
                  )
                : Image.memory(m.bytes, fit: BoxFit.cover),
          ),
          if (isCover || m.isVideo)
            Positioned(
              left: 6,
              bottom: 6,
              child: AppTag(isCover ? 'COVER' : 'VIDEO', color: isCover ? DobhaColors.green : DobhaColors.red, solid: true),
            ),
          Positioned(
            top: 4,
            right: 4,
            child: OverlayIconButton(
              icon: Icons.close_rounded,
              size: 16,
              tooltip: 'Remove',
              onTap: _busy ? null : () => setState(() => _media.removeAt(index)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _addButton(IconData icon, String label, VoidCallback onTap) {
    return Expanded(
      child: AppButton(
        padding: const EdgeInsets.symmetric(vertical: 13),
        onPressed: _busy || _media.length >= _maxMedia ? null : onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 20),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _dropdown(String label, String value, List<String> options, ValueChanged<String> onChanged) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      decoration: InputDecoration(labelText: label),
      dropdownColor: DobhaColors.cardElevated,
      items: options.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(),
      onChanged: (v) {
        if (v != null) setState(() => onChanged(v));
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 68,
        leading: Padding(
          padding: const EdgeInsets.only(left: 12),
          child: Center(
            child: AppButton.icon(icon: Icons.arrow_back_rounded, size: 20, padding: 9, onPressed: () => Navigator.of(context).pop()),
          ),
        ),
        leadingWidth: 64,
        title: const Text('New Listing'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          Row(
            children: [
              const Expanded(child: Text('Photos & Videos', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14))),
              Text('${_media.length}/$_maxMedia', style: const TextStyle(color: DobhaColors.muted, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 4),
          const Text('The first photo is the cover. Add up to 3 short videos.',
              style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
          const SizedBox(height: 12),
          if (_media.isEmpty)
            const AppWell(
              padding: EdgeInsets.symmetric(vertical: 34),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.add_photo_alternate_outlined, size: 36, color: DobhaColors.muted),
                    SizedBox(height: 8),
                    Text('Show the piece from every angle', style: TextStyle(color: DobhaColors.muted, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            )
          else
            SizedBox(
              height: 136,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _media.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (_, i) => _mediaTile(i),
              ),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              _addButton(Icons.photo_library_outlined, 'Photos', () => _addPhotos(camera: false)),
              const SizedBox(width: 10),
              _addButton(Icons.photo_camera_outlined, 'Camera', () => _addPhotos(camera: true)),
              const SizedBox(width: 10),
              _addButton(Icons.videocam_outlined, 'Video', _chooseVideoSource),
            ],
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _title,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'What is it? (e.g. 90s Carhartt Detroit Jacket)'),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _price,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Price', prefixText: 'R '),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _dropdown('Category', _category, ThriftItem.categories, (v) => _category = v)),
              const SizedBox(width: 12),
              Expanded(child: _dropdown('Size', _size, ThriftItem.sizes, (v) => _size = v)),
            ],
          ),
          const SizedBox(height: 14),
          _dropdown('Condition', _condition, ThriftItem.conditions, (v) => _condition = v),
          const SizedBox(height: 14),
          TextField(
            controller: _caption,
            maxLength: 200,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Caption for the feed (optional)'),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _description,
            maxLines: 4,
            minLines: 2,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Details: fit, flaws, measurements (optional)'),
          ),
          const SizedBox(height: 18),
          if (_error != null)
            AppWell(
              radius: 14,
              tint: DobhaColors.red,
              margin: const EdgeInsets.only(bottom: 14),
              child: Text(_error!, style: const TextStyle(color: DobhaColors.red, fontWeight: FontWeight.w600)),
            ),
          AppButton(
            color: DobhaColors.green,
            padding: const EdgeInsets.symmetric(vertical: 17),
            onPressed: _busy ? null : _submit,
            child: _busy
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.black)),
                      const SizedBox(width: 10),
                      Text(_progress ?? 'Publishing...', style: const TextStyle(fontSize: 14)),
                    ],
                  )
                : const Text('Publish Listing', style: TextStyle(fontSize: 15)),
          ),
        ],
      ),
    );
  }
}
