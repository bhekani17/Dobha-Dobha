import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (command === 'build') {
    const apiBase = env.VITE_API_BASE_URL;
    const stage = env.VITE_DEPLOYMENT_STAGE;
    if (!apiBase) {
      throw new Error('Set VITE_API_BASE_URL to the API this website build will use.');
    }
    if (!['dev', 'prod'].includes(stage)) {
      throw new Error('Set VITE_DEPLOYMENT_STAGE to either "dev" or "prod".');
    }
    if (stage === 'prod') {
      let apiUrl;
      try {
        apiUrl = new URL(apiBase);
      } catch {
        throw new Error('Production VITE_API_BASE_URL must be a valid HTTPS URL.');
      }
      if (apiUrl.protocol !== 'https:' || /\/dev\/?$/.test(apiUrl.pathname)) {
        throw new Error('Production builds require an HTTPS API URL that is not the dev stage.');
      }
    }
  }

  return {};
});
