import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PAGE_SIZE = 40;
const DISCOVERY_CATEGORIES = [
  'All categories',
  'Jackets',
  'Denim',
  'Sneakers',
  'Workwear',
  'Vintage Tees',
  'Knitwear',
  'Clothing & Accessories',
  'Shoes',
  'Electronics',
  'Home & Living',
  'Books & Media',
  'Sports & Outdoors',
  'Toys & Games',
  'Beauty & Personal Care',
  'Collectibles',
  'Other',
];

function listingMedia(item, resolveMedia) {
  const media = Array.isArray(item.media)
    ? item.media
      .map((entry) => ({
        kind: typeof entry === 'object' && (entry.kind === 'video' || entry.type === 'video') ? 'video' : 'image',
        url: typeof entry === 'string' ? entry : entry?.url || entry?.src || '',
      }))
      .filter((entry) => entry.url)
    : [];

  const photos = Array.isArray(item.photos) ? item.photos : [];
  if (media.length) {
    return media.map((entry) => ({ ...entry, url: resolveMedia(entry.url) }));
  }

  const entries = photos.map((photo) => ({
    kind: 'image',
    url: typeof photo === 'string' ? photo : photo?.url || '',
  }));
  if (item.photoUrl && !entries.some((entry) => entry.url === item.photoUrl)) {
    entries.unshift({ kind: 'image', url: item.photoUrl });
  }
  if (item.videoUrl && !entries.some((entry) => entry.url === item.videoUrl)) {
    entries.push({ kind: 'video', url: item.videoUrl });
  }
  return entries
    .filter((entry) => entry.url)
    .map((entry) => ({ ...entry, url: resolveMedia(entry.url) }));
}

function FeedVideo({ active, src, title }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (active && document.visibilityState === 'visible') {
      video.play().catch((error) => {
        if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
          console.error('Unable to play listing video:', error);
        }
      });
    } else {
      video.pause();
    }
    return () => video.pause();
  }, [active]);

  return (
    <video
      ref={videoRef}
      src={src}
      aria-label={`${title} listing video`}
      controls
      muted
      loop
      playsInline
      preload="metadata"
    />
  );
}

function FeedCard({ item, active, onAction, onMediaChange, mediaIndex, onReport, onShare, openListing, openSeller }) {
  const media = listingMedia(item, window.DobhaWeb.resolveMedia);
  const seller = item.seller || {};
  const sellerName = seller.name || item.sellerName || 'Dobha seller';
  const sellerId = seller.id || item.sellerId || '';
  const title = item.title || 'A fresh find';
  const price = item.priceZar;
  const mediaPosition = Math.min(mediaIndex, Math.max(media.length - 1, 0));

  const handleDoubleClick = (event) => {
    if (event.target.closest('button, video, a')) return;
    onAction(item, 'like');
  };

  return (
    <article className="reel-card" data-feed-card={item.id} onDoubleClick={handleDoubleClick}>
      <div
        className="reel-media-track"
        aria-label={`${title} photos and videos`}
        onScroll={(event) => {
          const width = event.currentTarget.clientWidth;
          if (width) onMediaChange(item.id, Math.round(event.currentTarget.scrollLeft / width));
        }}
      >
        {media.length ? media.map((entry, index) => (
          <div className="reel-media-slide" key={`${entry.url}-${index}`}>
            {entry.kind === 'video'
              ? <FeedVideo active={active && index === mediaPosition} src={entry.url} title={title} />
              : <img src={entry.url} alt={`${title}, image ${index + 1}`} loading={active ? 'eager' : 'lazy'} />}
          </div>
        )) : (
          <div className="reel-media-empty" role="img" aria-label={`No photo available for ${title}`}>
            <p>{title}</p><small>Photo not provided</small>
          </div>
        )}
      </div>

      {media.length > 1 && (
        <div className="reel-media-dots" aria-label={`Image ${mediaPosition + 1} of ${media.length}`}>
          {media.map((entry, index) => (
            <span key={`${entry.url}-dot`} className={index === mediaPosition ? 'active' : ''} />
          ))}
        </div>
      )}

      <div className="reel-caption">
        <button className="reel-seller" type="button" onClick={() => openSeller(sellerId)}>
          {seller.avatarUrl || item.sellerAvatarUrl
            ? <img src={window.DobhaWeb.resolveMedia(seller.avatarUrl || item.sellerAvatarUrl)} alt="" />
            : <span className="reel-avatar-fallback" aria-hidden="true">{sellerName.slice(0, 1).toUpperCase()}</span>}
          <span>{sellerName}{seller.handle ? ` · @${seller.handle}` : ''}</span>
        </button>
        <button className="reel-title" type="button" onClick={() => openListing(item)}>{title}</button>
        <p>{window.DobhaWeb.money(price)} · {item.condition || 'Pre-loved'}{item.size && item.size !== 'N/A' ? ` · ${item.size}` : ''}</p>
        {item.description && <p className="reel-description">{item.description}</p>}
      </div>

      <div className="reel-actions" aria-label={`${title} actions`}>
        <button type="button" aria-label={item.isLiked ? 'Unlike listing' : 'Like listing'} onClick={() => onAction(item, 'like')}>
          <span>{item.isLiked ? 'Liked' : 'Like'}</span><small>{Number(item.likesCount) || 0}</small>
        </button>
        <button type="button" aria-label="Open listing and comments" onClick={() => openListing(item)}>
          <span>Comments</span><small>{Number(item.commentsCount) || 0}</small>
        </button>
        <button type="button" aria-label={item.isSaved ? 'Remove saved listing' : 'Save listing'} onClick={() => onAction(item, 'save')}>
          <span>{item.isSaved ? 'Saved' : 'Save'}</span>
        </button>
        <details className="reel-more">
          <summary aria-label="More listing options"><span aria-hidden="true">•••</span><small>More</small></summary>
          <div className="reel-more-menu">
            <button type="button" onClick={() => openListing(item)}>Listing details & comments</button>
            <button type="button" onClick={() => onShare(item)}>Copy or share</button>
            <button type="button" onClick={() => onReport(item)}>Report listing</button>
          </div>
        </details>
      </div>
    </article>
  );
}

export function DiscoveryFeed() {
  const feedRef = useRef(null);
  const paginationRef = useRef(null);
  const cursorRef = useRef('');
  const loadingMoreRef = useRef(false);
  const [items, setItems] = useState([]);
  const [stories, setStories] = useState([]);
  const [storiesError, setStoriesError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [mediaIndices, setMediaIndices] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('All categories');
  const [sortBy, setSortBy] = useState('featured');
  const [savedOnly, setSavedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const app = window.DobhaWeb;

  const visibleItems = useMemo(() => {
    const nextItems = [...items].filter((item) => {
      const matchesCategory = selectedCategory === 'All categories' || item.category === selectedCategory;
      const matchesSaved = !savedOnly || Boolean(item.isSaved);
      return matchesCategory && matchesSaved;
    });

    if (sortBy === 'featured') return nextItems;

    return nextItems.sort((left, right) => {
      switch (sortBy) {
        case 'price-low':
          return Number(left.priceZar || 0) - Number(right.priceZar || 0);
        case 'price-high':
          return Number(right.priceZar || 0) - Number(left.priceZar || 0);
        case 'likes':
          return Number(right.likesCount || 0) - Number(left.likesCount || 0);
        case 'newest': {
          const leftTime = Date.parse(left.createdAt || left.created_at || left.updatedAt || left.updated_at || 0);
          const rightTime = Date.parse(right.createdAt || right.created_at || right.updatedAt || right.updated_at || 0);
          return rightTime - leftTime;
        }
        default:
          return 0;
      }
    });
  }, [items, savedOnly, selectedCategory, sortBy]);

  const fetchPage = useCallback(async (cursor = '') => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) params.set('offset', cursor);
    return app.api(`/api/items?${params}`);
  }, [app]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([fetchPage(), app.api('/api/stories')]).then(([feedResult, storyResult]) => {
      if (cancelled) return;
      if (feedResult.status === 'rejected') throw feedResult.reason;
      const result = feedResult.value;
      const nextItems = Array.isArray(result.items) ? result.items : [];
      setItems(nextItems);
      cursorRef.current = result.nextCursor || '';
      if (storyResult.status === 'fulfilled') {
        setStories(Array.isArray(storyResult.value.stories) ? storyResult.value.stories : []);
        setStoriesError('');
      } else {
        setStoriesError(storyResult.reason.message || 'Seller stories could not be loaded.');
      }
      setError('');
    }).catch((requestError) => {
      if (!cancelled) setError(requestError.message || 'The discovery feed could not be loaded.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [app, fetchPage]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (visible) setActiveId(visible.target.dataset.feedCard || '');
    }, { threshold: [0.35, 0.65] });

    root.querySelectorAll('[data-feed-card]').forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [items]);

  const loadMore = useCallback(async () => {
    if (!cursorRef.current || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const result = await fetchPage(cursorRef.current);
      setItems((current) => {
        const existing = new Set(current.map((item) => item.id));
        return [...current, ...(result.items || []).filter((item) => !existing.has(item.id))];
      });
      cursorRef.current = result.nextCursor || '';
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'More listings could not be loaded.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    const sentinel = paginationRef.current;
    if (!sentinel || !cursorRef.current) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { rootMargin: '700px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items, loadMore]);

  const handleAction = async (item, action) => {
    const updated = await app.itemAction(item.id, action, action === 'like' ? 'Likes' : 'Saved items');
    if (updated) {
      setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
    }
  };

  const handleShare = async (item) => {
    const url = new URL(window.location.href);
    url.hash = `product?id=${encodeURIComponent(item.id)}`;
    const shareData = {
      title: item.title || 'Dobha Dobha find',
      text: `${item.title || 'A find'} · ${app.money(item.priceZar)} from ${item.seller?.name || item.sellerName || 'a Dobha seller'}`,
      url: url.toString(),
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        app.notify('Listing link copied.');
      }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') app.notify(shareError.message || 'Unable to share this listing.', true);
    }
  };

  const handleReport = async (item) => {
    const reported = await app.reportItem(item.id);
    if (reported) setItems((current) => current.filter((entry) => entry.id !== item.id));
  };

  const openListing = (item) => app.openProduct(item);
  const openSeller = (sellerId) => {
    if (sellerId) window.location.hash = `profile?id=${encodeURIComponent(sellerId)}`;
  };

  const clearFilters = () => {
    setSelectedCategory('All categories');
    setSortBy('featured');
    setSavedOnly(false);
  };

  if (loading) return <p className="muted reel-status" role="status">Finding the good stuff…</p>;
  if (error && !items.length) return <div className="reel-status" role="alert"><p>{error}</p><button className="button button-outline" onClick={() => window.location.reload()}>Reload feed</button></div>;

  return (
    <>
      <div className="feed-toolbar" aria-label="Discovery controls">
        <div className="feed-filter-group" aria-label="Listing categories">
          {DISCOVERY_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={`filter-chip${selectedCategory === category ? ' active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="feed-toolbar-row">
          <label className="feed-sort">
            <span>Sort</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="likes">Most liked</option>
            </select>
          </label>
          <button type="button" className={`feed-toggle${savedOnly ? ' active' : ''}`} onClick={() => setSavedOnly((value) => !value)}>
            {savedOnly ? 'Saved only' : 'Saved only off'}
          </button>
          <button type="button" className="button button-outline button-small" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      </div>

      {stories.length > 0 && (
        <nav className="feed-stories" aria-label="Seller stories">
          {stories.map((group, index) => (
            <button type="button" className="story-ring" key={group.userId || group.userHandle || index} onClick={() => app.viewStories(stories, index)}>
              <span>{group.avatarUrl
                ? <img src={app.resolveMedia(group.avatarUrl)} alt="" />
                : (group.userName || 'S').slice(0, 1).toUpperCase()}</span>
              <small>{group.userName || 'Seller'}</small>
            </button>
          ))}
        </nav>
      )}
      {!visibleItems.length ? (
        <p className="muted reel-status">No listings match this filter yet. Try another category or clear the filters.</p>
      ) : (
        <section className="reels-feed-scroll" ref={feedRef} aria-label="Marketplace discovery feed">
          {visibleItems.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              active={activeId === item.id}
              mediaIndex={mediaIndices[item.id] || 0}
              onAction={handleAction}
              onMediaChange={(id, index) => setMediaIndices((current) => ({ ...current, [id]: index }))}
              onReport={handleReport}
              onShare={handleShare}
              openListing={openListing}
              openSeller={openSeller}
            />
          ))}
          {loadingMore && <p className="reel-loading-more" role="status">Finding more listings…</p>}
          {error && <p className="reel-loading-more" role="alert">{error}</p>}
          {cursorRef.current && (
            <div className="feed-pagination">
              <span ref={paginationRef} aria-hidden="true" />
              <button type="button" className="button button-outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading listings…' : 'Load more listings'}
              </button>
            </div>
          )}
        </section>
      )}
      {storiesError && <p className="reel-story-error" role="status">{storiesError}</p>}
    </>
  );
}
