import { useState } from 'react'
import { sized } from '@/lib/img'
import { Img } from '../ui/Img'
import s from './Gallery.module.css'

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0)
  const current = images[index] ?? null

  return (
    <div className={s.gallery}>
      <Img key={current} src={current} alt={alt} priority ratio="16 / 10" sizes="(max-width: 1000px) 100vw, 720px" className={s.main} />
      {images.length > 1 && (
        <div className={s.thumbs} role="tablist" aria-label="Photos">
          {images.map((src, i) => (
            <button
              key={src}
              role="tab"
              aria-selected={i === index}
              aria-label={`Photo ${i + 1} of ${images.length}`}
              className={s.thumb}
              onClick={() => setIndex(i)}
            >
              <img src={sized(src, 200)} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
