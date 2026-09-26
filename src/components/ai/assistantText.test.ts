import { describe, it, expect } from 'vitest';
import { citationRoute, linkCitationMarkers, questionBytes } from './assistantText';

describe('linkCitationMarkers', () => {
  it.each([
    ['See [1].', 'See [1](#cite-1).'],
    ['See [1][2].', 'See [1](#cite-1)[2](#cite-2).'],
    ['See [1, 3].', 'See [1](#cite-1)[3](#cite-3).'],
    ['See [2-4].', 'See [2](#cite-2)[3](#cite-3)[4](#cite-4).'],
    ['See [1–2].', 'See [1](#cite-1)[2](#cite-2).'],
    ['A real [link](https://x.y) stays a link.', 'A real [link](https://x.y) stays a link.'],
    ['No markers here.', 'No markers here.'],
  ])('%s', (input, want) => {
    expect(linkCitationMarkers(input)).toBe(want);
  });

  it('caps a runaway range', () => {
    expect(linkCitationMarkers('[1-9999]').match(/#cite-/g)).toHaveLength(10);
  });

  it('leaves a marker-shaped index inside inline code untouched', () => {
    expect(linkCitationMarkers('Use `array[1]` to index it, see [2].')).toBe(
      'Use `array[1]` to index it, see [2](#cite-2).',
    );
  });

  it('leaves a marker-shaped index inside a fenced code block untouched', () => {
    const input = 'See [1].\n\n```js\nconst x = arr[2];\n```\n\nAlso [3].';
    const want = 'See [1](#cite-1).\n\n```js\nconst x = arr[2];\n```\n\nAlso [3](#cite-3).';
    expect(linkCitationMarkers(input)).toBe(want);
  });
});

describe('questionBytes', () => {
  it('counts UTF-8 bytes, matching the backend limit', () => {
    expect(questionBytes('abc')).toBe(3);
    expect(questionBytes('é')).toBe(2);
    expect(questionBytes('€')).toBe(3);
  });
});

describe('citationRoute', () => {
  it('routes a typed record citation to its own detail page', () => {
    expect(citationRoute({ source_type: 'record', source_id: 'r1', snippet: '', record_type: 'customer' })).toBe('/crm/customer/r1');
  });

  it('returns null for help citations and records of unknown type', () => {
    expect(citationRoute({ source_type: 'help', source_id: 'x', snippet: '' })).toBeNull();
    expect(citationRoute({ source_type: 'record', source_id: 'r1', snippet: '' })).toBeNull();
  });
});
