import { useState } from 'react'
import { sized, srcSet } from '@/lib/img'
import s from './Img.module.css'

/** Responsive, lazy image with a fixed aspect ratio so nothing shifts while it loads. */
export function Img({
  src,
  alt,
  sizes = '100vw',
  ratio = '16 / 10',
  priority,
  className,
}: {
  src: string | null | undefined
  alt: string
  sizes?: string
  ratio?: string
  priority?: boolean
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={`${s.frame} ${className ?? ''}`} style={{ aspectRatio: ratio }}>
      {src && (
        <img
          src={sized(src, 960)}
          srcSet={srcSet(src)}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={s.img}
          data-loaded={loaded || undefined}
          onLoad={() => setLoaded(true)}
          ref={(el) => {
            if (el?.complete) setLoaded(true)
          }}
        />
      )}
    </div>
  )
}
