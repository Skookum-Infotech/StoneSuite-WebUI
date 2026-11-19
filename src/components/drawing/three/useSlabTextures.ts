// Loads slab photos as WebGL textures, one per distinct photo link. The link is a short-lived
// URL to another origin (the shop's file storage), which WebGL may only read when that storage
// answers with CORS headers. A photo that fails (blocked, or the link has expired) is counted so
// the viewer can say so; its pieces keep the plain stone colour and nothing else breaks.
//
// The photo is fetched with the cache bypassed and then handed to three.js as a same-origin blob.
// The 2D board shows the very same link in a plain <img>/<image>, and the browser would otherwise
// reuse that cached copy, which carries no CORS headers, for this request and refuse it even when
// the storage allows the site.

import { useEffect, useState } from 'react';
import { SRGBColorSpace, TextureLoader, type Texture } from 'three';

interface Loaded {
  /** The set of links this state belongs to. */
  key: string;
  textures: Record<string, Texture>;
  failed: number;
}

export interface SlabTextures {
  /** By photo link. */
  textures: Record<string, Texture>;
  /** How many links could not be loaded. */
  failed: number;
}

const NONE: SlabTextures = { textures: {}, failed: 0 };
const KEY_SEPARATOR = '\n';
const TEXTURE_ANISOTROPY = 8;

/** Fetches the photo's bytes straight from storage (cache bypassed), as a blob. */
async function fetchPhotoBlob(url: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { mode: 'cors', cache: 'reload', credentials: 'omit', signal });
  if (!response.ok) throw new Error(`storage answered HTTP ${response.status}`);
  return response.blob();
}

function textureFromBlob(blob: Blob): Promise<Texture> {
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    new TextureLoader().load(
      objectUrl,
      (texture) => {
        URL.revokeObjectURL(objectUrl);
        texture.colorSpace = SRGBColorSpace;
        // Keeps the stone sharp when the counter is seen at a low angle (capped to what the GPU allows).
        texture.anisotropy = TEXTURE_ANISOTROPY;
        resolve(texture);
      },
      undefined,
      () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('the file is not a readable image'));
      },
    );
  });
}

export function useSlabTextures(urls: string[]): SlabTextures {
  const key = [...new Set(urls)].sort().join(KEY_SEPARATOR);
  const [state, setState] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!key) return undefined;
    const abort = new AbortController();
    const made: Texture[] = [];
    // A state from an older set of links is dropped on the first result of the new one.
    const update = (change: (current: Loaded) => Loaded) => setState((s) => change(s && s.key === key ? s : { key, textures: {}, failed: 0 }));

    key.split(KEY_SEPARATOR).forEach((url) => {
      fetchPhotoBlob(url, abort.signal)
        .then(textureFromBlob)
        .then((texture) => {
          if (abort.signal.aborted) {
            texture.dispose();
            return;
          }
          made.push(texture);
          update((s) => ({ ...s, textures: { ...s.textures, [url]: texture } }));
        })
        .catch((error: unknown) => {
          if (abort.signal.aborted) return;
          const reason = error instanceof Error ? error.message : String(error);
          // A CORS refusal surfaces as a bare "Failed to fetch"; the origin is what to allow.
          console.warn(`3D view: a slab photo could not be loaded as a texture (${reason}). If this says "Failed to fetch", the file storage does not allow ${window.location.origin}.`);
          update((s) => ({ ...s, failed: s.failed + 1 }));
        });
    });

    return () => {
      abort.abort();
      made.forEach((t) => t.dispose());
    };
  }, [key]);

  return state && state.key === key ? state : NONE;
}
