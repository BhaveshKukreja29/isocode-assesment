const WIDTHS = [400, 640, 960, 1280, 1920]

const isUnsplash = (url: string) => url.startsWith('https://images.unsplash.com/')

/** Resized image URL. Unsplash resizes on its CDN; other hosts get the original. */
export function sized(url: string, width: number) {
  return isUnsplash(url) ? `${url}?auto=format&fit=crop&w=${width}&q=70` : url
}

export function srcSet(url: string, max = 1920) {
  if (!isUnsplash(url)) return undefined
  return WIDTHS.filter((w) => w <= max)
    .map((w) => `${sized(url, w)} ${w}w`)
    .join(', ')
}
