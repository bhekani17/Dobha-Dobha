import React, { useEffect } from 'react';

import legacyDocument from './legacy.html?raw';

export function App() {
  useEffect(() => {
    import('../app.js').catch((error) => {
      console.error('The marketplace application failed to initialize:', error);
    });
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: legacyDocument }} />;
}
