// Parses a DXF off the main thread, so dxf-parser's chunk loads only when a
// file is opened and a bad file can't freeze the page (dxfParseClient.ts
// terminates this worker if it never answers).

import { buildDxfScene } from './dxfScene';
import { decodeDxfBytes } from './dxfText';
import { DxfTooComplexError, type DxfScene } from './dxfSceneTypes';

export type DxfWorkerReply =
  | { ok: true; scene: DxfScene }
  | { ok: false; kind: 'unreadable' | 'too_complex'; message: string };

self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  let reply: DxfWorkerReply;
  try {
    reply = { ok: true, scene: buildDxfScene(decodeDxfBytes(event.data)) };
  } catch (err) {
    reply = {
      ok: false,
      kind: err instanceof DxfTooComplexError ? 'too_complex' : 'unreadable',
      message: err instanceof Error ? err.message : String(err),
    };
  }
  self.postMessage(reply);
};
