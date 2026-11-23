// dxf-parser drops entity types it doesn't know without telling anyone, so the
// only way to report them is to look at the file's text ourselves.

/** Every entity type dxf-parser hands back. */
const PARSED_ENTITY_TYPES = new Set([
  '3DFACE', 'ARC', 'ATTDEF', 'CIRCLE', 'DIMENSION', 'ELLIPSE', 'INSERT', 'LINE', 'LWPOLYLINE',
  'MTEXT', 'POINT', 'POLYLINE', 'SOLID', 'SPLINE', 'TEXT',
]);
/** Not content a reader would miss: file structure, and the paper-space window. */
const STRUCTURAL_TYPES = new Set(['VERTEX', 'SEQEND', 'ATTRIB', 'ENDSEC', 'EOF', 'SECTION', 'BLOCK', 'ENDBLK', 'VIEWPORT']);
const SCANNED_SECTIONS = new Set(['ENTITIES', 'BLOCKS']);

export type TypeCounts = Record<string, number>;
export type UnparsedEntities = { topLevel: TypeCounts; byBlock: Map<string, TypeCounts> };

/** Unknown entity types, top-level and per block, leaving out any a reader
 *  wouldn't see anyway (in paper space, or on a hidden layer). */
export function scanUnparsedEntities(text: string, hiddenLayers: ReadonlySet<string>): UnparsedEntities {
  const result: UnparsedEntities = { topLevel: {}, byBlock: new Map() };
  const lines = text.split(/\r\n|\r|\n/);
  let section = '';
  let block: string | null = null;
  let awaiting: 'section' | 'block' | null = null;
  let entity: { type: string; layer: string; paperSpace: boolean } | null = null;

  const flush = () => {
    if (!entity || entity.paperSpace || hiddenLayers.has(entity.layer.toUpperCase())) return;
    let counts = result.topLevel;
    if (block !== null) {
      counts = result.byBlock.get(block) ?? {};
      result.byBlock.set(block, counts);
    }
    counts[entity.type] = (counts[entity.type] ?? 0) + 1;
  };

  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1].trim();
    if (code === '0') {
      flush();
      entity = null;
      if (value === 'SECTION') awaiting = 'section';
      else if (value === 'BLOCK') awaiting = 'block';
      else if (value === 'ENDBLK') block = null;
      else if (SCANNED_SECTIONS.has(section) && !PARSED_ENTITY_TYPES.has(value) && !STRUCTURAL_TYPES.has(value)) {
        entity = { type: value, layer: '', paperSpace: false };
      }
    } else if (code === '2' && awaiting) {
      if (awaiting === 'section') section = value;
      else block = value;
      awaiting = null;
    } else if (entity && code === '8') {
      entity.layer = value;
    } else if (entity && code === '67') {
      entity.paperSpace = value !== '0';
    }
  }
  flush();
  return result;
}
