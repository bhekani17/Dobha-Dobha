import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import { DiscoveryFeed } from './DiscoveryFeed.jsx';
import legacyDocument from './legacy.html?raw';

export function App() {
  useEffect(() => {
    let disposed = false;
    let feedRoot;

    import('../app.js')
      .then(() => {
        if (disposed) return;
        const feed = document.getElementById('reels-feed');
        if (!feed) throw new Error('The discovery feed mount point is missing.');
        feedRoot = createRoot(feed);
        feedRoot.render(<DiscoveryFeed />);
      })
      .catch((error) => {
        console.error('The marketplace application failed to initialize:', error);
      });

    return () => {
      disposed = true;
      feedRoot?.unmount();
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: legacyDocument }} />;
}
