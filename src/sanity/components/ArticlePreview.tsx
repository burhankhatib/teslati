import { PreviewProps } from 'sanity'
import createImageUrlBuilder from '@sanity/image-url'
import { dataset, projectId } from '../env'

interface ArticlePreviewProps extends PreviewProps {
  title?: string
  subtitle?: string
  media?: any
  imageUrl?: string
}

const builder = createImageUrlBuilder({ projectId, dataset })

export function ArticlePreview(props: ArticlePreviewProps) {
  const { title, subtitle, media, imageUrl } = props

  // Determine which image to use
  let imageSrc: string | null = null
  
  if (media?.asset) {
    // Use Sanity image asset
    try {
      imageSrc = builder.image(media).width(200).height(200).url() || null
    } catch (e) {
      // Fallback to imageUrl if Sanity image fails
      imageSrc = imageUrl || null
    }
  } else if (imageUrl) {
    // Use external imageUrl as fallback
    imageSrc = imageUrl
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px' }}>
      {imageSrc && (
        <img
          src={imageSrc}
          alt={title || 'Article'}
          style={{
            width: '60px',
            height: '60px',
            objectFit: 'cover',
            borderRadius: '4px',
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>
          {title || 'Untitled'}
        </div>
        {subtitle && (
          <div style={{ color: '#666', fontSize: '12px' }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}

