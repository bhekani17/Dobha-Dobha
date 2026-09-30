import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/ui.dart';
import '../widgets/user_avatar.dart';

/// Profile picture, name, bio, location, phone and (for vendors) shop details.
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  static Future<void> open(BuildContext context) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EditProfileScreen()));

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _user = AppState().user;
  late final _name = TextEditingController(text: _user.name);
  late final _bio = TextEditingController(text: _user.bio);
  late final _location = TextEditingController(text: _user.location);
  late final _phone = TextEditingController(text: _user.phone);
  late final _shop = TextEditingController(text: _user.shopName);
  late final _stall = TextEditingController(text: _user.stallLocation);

  bool _saving = false;
  bool _uploadingPhoto = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _bio, _location, _phone, _shop, _stall]) {
      c.dispose();
    }
    super.dispose();
  }

  void _snack(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _changePhoto(ImageSource? source) async {
    try {
      if (source == null) {
        setState(() => _uploadingPhoto = true);
        await AppState().setAvatar(null);
        return;
      }
      final file = await ImagePicker().pickImage(source: source, maxWidth: 800, maxHeight: 800, imageQuality: 85);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      final name = file.name.toLowerCase();
      final type = file.mimeType ?? (name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
      setState(() => _uploadingPhoto = true);
      await AppState().setAvatar(bytes, contentType: type);
    } on ApiException catch (e) {
      if (mounted) _snack(e.message);
    } catch (_) {
      if (mounted) _snack('Could not open photos. Check the app has permission.');
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  void _photoOptions() {
    final hasPhoto = AppState().user.avatarUrl != null;
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Profile picture', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              for (final (icon, label, source) in [
                (Icons.photo_camera_outlined, 'Take a photo', ImageSource.camera),
                (Icons.photo_library_outlined, 'Choose from gallery', ImageSource.gallery),
              ]) ...[
                AppButton(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    _changePhoto(source);
                  },
                  child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 18), const SizedBox(width: 8), Text(label)]),
                ),
                const SizedBox(height: 10),
              ],
              if (hasPhoto)
                AppButton(
                  foreground: DobhaColors.red,
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    _changePhoto(null);
                  },
                  child: const Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.delete_outline_rounded, size: 18),
                    SizedBox(width: 8),
                    Text('Remove picture'),
                  ]),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _save() async {
    if (_name.text.trim().length < 2) return setState(() => _error = 'Enter your name');
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await AppState().updateProfile(
        name: _name.text.trim(),
        bio: _bio.text.trim(),
        location: _location.text.trim(),
        phone: _phone.text.trim(),
        shopName: _user.isVendor ? _shop.text.trim() : null,
        stallLocation: _user.isVendor ? _stall.text.trim() : null,
      );
      if (mounted) {
        Navigator.of(context).pop();
        _snack('Profile updated');
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _field(String label, TextEditingController ctrl,
      {TextInputType type = TextInputType.text, int maxLines = 1, int? maxLength, IconData? icon}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextField(
        controller: ctrl,
        keyboardType: type,
        maxLines: maxLines,
        minLines: 1,
        maxLength: maxLength,
        textCapitalization: type == TextInputType.text ? TextCapitalization.sentences : TextCapitalization.none,
        decoration: InputDecoration(labelText: label, prefixIcon: icon == null ? null : Icon(icon, size: 19)),
      ),
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
        title: const Text('Edit Profile'),
      ),
      body: ListenableBuilder(
        listenable: AppState(),
        builder: (context, _) {
          final user = AppState().user;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              Center(
                child: GestureDetector(
                  onTap: _uploadingPhoto ? null : _photoOptions,
                  child: Stack(
                    children: [
                      UserAvatar(url: user.avatarUrl, name: user.name, size: 108),
                      if (_uploadingPhoto)
                        Positioned.fill(
                          child: ClipOval(
                            child: ColoredBox(
                              color: Colors.black54,
                              child: Center(child: CircularProgressIndicator(color: DobhaColors.green, strokeWidth: 2.4)),
                            ),
                          ),
                        ),
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: DobhaColors.green, shape: BoxShape.circle),
                          child: const Icon(Icons.photo_camera_rounded, size: 18, color: Colors.black),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: TextButton(
                  onPressed: _uploadingPhoto ? null : _photoOptions,
                  child: Text(user.avatarUrl == null ? 'Add profile picture' : 'Change profile picture'),
                ),
              ),
              const SizedBox(height: 12),
              _field('Full name', _name, icon: Icons.person_outline_rounded),
              _field('Bio', _bio, maxLines: 3, maxLength: 160, icon: Icons.notes_rounded),
              _field('Area (e.g. Soweto, Braamfontein)', _location, icon: Icons.location_on_outlined),
              _field('Phone', _phone, type: TextInputType.phone, icon: Icons.phone_outlined),
              AppWell(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    Icon(Icons.mail_outline_rounded, size: 19, color: DobhaColors.muted),
                    const SizedBox(width: 12),
                    Expanded(child: Text(user.email, style: TextStyle(color: DobhaColors.textSecondary))),
                    Text(user.handle, style: TextStyle(color: DobhaColors.muted, fontSize: 12)),
                  ],
                ),
              ),
              if (user.isVendor) ...[
                const SizedBox(height: 8),
                const Text('Shop', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                const SizedBox(height: 10),
                _field('Shop name', _shop, icon: Icons.storefront_outlined),
                _field('Stall location', _stall, icon: Icons.place_outlined),
              ],
              if (_error != null)
                AppWell(
                  tint: DobhaColors.red,
                  margin: const EdgeInsets.only(bottom: 14),
                  child: Text(_error!, style: TextStyle(color: DobhaColors.red, fontWeight: FontWeight.w600)),
                ),
              const SizedBox(height: 6),
              AppButton(
                color: DobhaColors.green,
                padding: const EdgeInsets.symmetric(vertical: 16),
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.black))
                    : const Text('Save Changes', style: TextStyle(fontSize: 15)),
              ),
            ],
          );
        },
      ),
    );
  }
}
