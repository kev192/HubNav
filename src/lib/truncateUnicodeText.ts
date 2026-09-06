function getUnicodeGraphemes(value: string): string[] {
  if (!value) return []

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(value), ({ segment }) => segment)
  }

  return Array.from(value)
}

export function truncateUnicodeText(value: string, maxLength: number): string {
  if (maxLength <= 0) return ''

  const graphemes = getUnicodeGraphemes(value)
  if (graphemes.length <= maxLength) return value
  if (maxLength === 1) return '…'

  return `${graphemes.slice(0, maxLength - 1).join('')}…`
}
