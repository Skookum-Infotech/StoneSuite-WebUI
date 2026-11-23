// Main-thread side of dxfScene.worker.ts: one worker per file, always freed.

import type { DxfWorkerReply } from './dxfScene.worker';
import { DxfTooComplexError, DxfUnreadableError, type DxfScene } from './dxfSceneTypes';

/** dxf-parser can loop forever on a malformed file (a POLYLINE with no SEQEND). */
export const DXF_PARSE_TIMEOUT_MS = 20_000;

export function parseDxfScene(bytes: ArrayBuffer, signal?: AbortSignal): Promise<DxfScene> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./dxfScene.worker.ts', import.meta.url), { type: 'module' });

    const onAbort = () => finish(() => reject(new DOMException('Cancelled', 'AbortError')));
    const timer = setTimeout(() => finish(() => reject(new DxfUnreadableError())), DXF_PARSE_TIMEOUT_MS);

    function finish(settle: () => void) {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
      settle();
    }

    worker.onmessage = ({ data }: MessageEvent<DxfWorkerReply>) => {
      finish(() => {
        if (data.ok) resolve(data.scene);
        else if (data.kind === 'too_complex') reject(new DxfTooComplexError(data.message));
        else reject(new DxfUnreadableError(data.message));
      });
    };
    worker.onerror = () => finish(() => reject(new DxfUnreadableError()));
    signal?.addEventListener('abort', onAbort, { once: true });

    worker.postMessage(bytes, [bytes]);
  });
}
