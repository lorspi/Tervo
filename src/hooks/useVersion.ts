import { useState, useEffect } from 'react';

// GitHub raw URL for version.txt (will only work when repo is public)
const REMOTE_VERSION_URL = 'https://raw.githubusercontent.com/lorspi/Tervo/main/public/version.txt';

let cachedRemoteVersion: string | null = null;
let checkedForUpdate = false;

/** Returns the version the running JS bundle was built with. */
export function useVersion() {
  return __APP_VERSION__ || '';
}

/** Checks the remote repository for a newer version. */
export function useUpdateCheck() {
  const [localVersion] = useState(__APP_VERSION__ || '');
  const [remoteVersion, setRemoteVersion] = useState(cachedRemoteVersion || '');
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (checkedForUpdate) {
      setRemoteVersion(cachedRemoteVersion || '');
      setUpdateAvailable(
        !!cachedRemoteVersion && cachedRemoteVersion !== __APP_VERSION__
      );
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(REMOTE_VERSION_URL, { cache: 'no-store' });
        if (cancelled) return;
        // If fetch fails (404, CORS, private repo), silently skip
        if (!res.ok) {
          checkedForUpdate = true;
          return;
        }
        cachedRemoteVersion = (await res.text()).trim();
        setRemoteVersion(cachedRemoteVersion);

        const hasUpdate = cachedRemoteVersion !== __APP_VERSION__;
        setUpdateAvailable(hasUpdate);
      } catch {
        // Repo is private or no internet — no update notification
        if (!cancelled) setUpdateAvailable(false);
      } finally {
        if (!cancelled) checkedForUpdate = true;
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

  return {
    localVersion,
    remoteVersion,
    updateAvailable,
  };
}
