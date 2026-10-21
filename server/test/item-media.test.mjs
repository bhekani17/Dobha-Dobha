import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeListingMedia } = require('../src/items/handler.js');

describe('listing media normalization', () => {
  it('separates uploaded product photos and video keys', () => {
    assert.deepEqual(normalizeListingMedia({
      media: [
        { key: 'uploads/user/photo.jpg', kind: 'image' },
        { key: 'uploads/user/clip.mp4', kind: 'video' },
      ],
    }), {
      photos: ['/media/uploads/user/photo.jpg'],
      videoUrls: ['/media/uploads/user/clip.mp4'],
      videoUrl: '/media/uploads/user/clip.mp4',
    });
  });

  it('recognizes video keys from older mobile clients', () => {
    assert.deepEqual(normalizeListingMedia({
      media: [{ key: 'uploads/user/photo.webp' }, { key: 'uploads/user/clip.webm' }],
    }), {
      photos: ['/media/uploads/user/photo.webp'],
      videoUrls: ['/media/uploads/user/clip.webm'],
      videoUrl: '/media/uploads/user/clip.webm',
    });
  });

  it('preserves all supported product videos', () => {
    const normalized = normalizeListingMedia({
      media: [
        { key: 'uploads/user/front.jpg' },
        { key: 'uploads/user/clip-one.mp4' },
        { key: 'uploads/user/side.jpg' },
        { key: 'uploads/user/clip-two.webm' },
      ],
    });
    assert.deepEqual(normalized, {
      photos: ['/media/uploads/user/front.jpg', '/media/uploads/user/side.jpg'],
      videoUrls: ['/media/uploads/user/clip-one.mp4', '/media/uploads/user/clip-two.webm'],
      videoUrl: '/media/uploads/user/clip-one.mp4',
    });
  });

  it('preserves the legacy photos and video URL payload', () => {
    assert.deepEqual(normalizeListingMedia({
      photos: ['/media/uploads/user/photo.jpg'],
      video_url: '/media/uploads/user/clip.mp4',
    }), {
      photos: ['/media/uploads/user/photo.jpg'],
      videoUrls: ['/media/uploads/user/clip.mp4'],
      videoUrl: '/media/uploads/user/clip.mp4',
    });
  });

  it('allows a media update to remove its previous video', () => {
    assert.deepEqual(normalizeListingMedia({
      media: [{ key: 'uploads/user/photo.jpg' }],
      videoUrl: null,
    }), {
      photos: ['/media/uploads/user/photo.jpg'],
      videoUrls: [],
      videoUrl: null,
    });
  });
});
