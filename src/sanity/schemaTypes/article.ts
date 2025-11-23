import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'article',
  title: 'Article',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title (English) - Admin Only',
      type: 'string',
      description: 'English title used for admin panel and slug generation. Not displayed on website.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'titleAr',
      title: 'Title (Arabic)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description (English) - Admin Only',
      type: 'text',
      rows: 4,
      description: 'English description for admin reference. Not displayed on website.',
    }),
    defineField({
      name: 'descriptionAr',
      title: 'Description (Arabic)',
      type: 'text',
      rows: 4,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'content',
      title: 'Content (English) - Admin Only',
      type: 'text',
      rows: 10,
      description: 'English plain text content for admin reference. Not displayed on website.',
    }),
    defineField({
      name: 'contentAr',
      title: 'Content (Arabic)',
      type: 'text',
      rows: 10,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'htmlContent',
      title: 'HTML Content (English) - Deprecated',
      type: 'text',
      rows: 15,
      description: 'Deprecated: English HTML content is no longer generated. This field is kept for backward compatibility only.',
      readOnly: true,
      hidden: true, // Hide from admin UI since it's always empty
    }),
    defineField({
      name: 'htmlContentAr',
      title: 'HTML Content (Arabic) - AI Generated',
      type: 'text',
      rows: 15,
      description: 'AI-generated styled HTML content in Arabic. This is the main content displayed on the website.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'imageUrl',
      title: 'Image URL',
      type: 'url',
    }),
    defineField({
      name: 'youtubeUrl',
      title: 'YouTube Video URL',
      type: 'url',
      description: 'Paste the YouTube video URL here (e.g., https://www.youtube.com/watch?v=...). The video will be automatically embedded at the top of the article. Leave empty if this article is not a YouTube video.',
      placeholder: 'https://www.youtube.com/watch?v=...',
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
      // Index for faster duplicate detection queries
      options: {
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm',
        timeStep: 1,
      },
    }),
    defineField({
      name: 'sourceUrl',
      title: 'Source URL',
      type: 'url',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'sourceName',
      title: 'Source Name - Internal Only',
      type: 'string',
      initialValue: 'Not a Tesla App',
      readOnly: true,
      description: 'Source name for internal tracking. Not displayed on website.',
      hidden: true, // Hide from admin UI since we don't display it
    }),
    defineField({
      name: 'rssGuid',
      title: 'RSS GUID',
      type: 'string',
      description: 'Unique identifier from RSS feed for duplicate detection',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'isPublished',
      title: 'Published',
      type: 'boolean',
      initialValue: true,
      description: 'Toggle to publish/unpublish article',
    }),
  ],
  preview: {
    select: {
      title: 'title', // English title as main title (easier to read)
      titleAr: 'titleAr', // Arabic title
      sourceName: 'sourceName', // Source name for identification
      media: 'image',
      imageUrl: 'imageUrl', // Fallback to URL if image asset not available
    },
    prepare({ title, titleAr, sourceName, media, imageUrl }) {
      // Use Sanity image asset if available, otherwise create a media object with imageUrl
      let previewMedia = media;
      
      // If no Sanity image asset but we have imageUrl, create a media-like object
      // Sanity will display external images in previews
      if (!previewMedia && imageUrl) {
        previewMedia = {
          _type: 'image',
          asset: {
            _type: 'reference',
            _ref: imageUrl,
          },
        };
      }
      
      // Combine Arabic title and source name in subtitle for better identification
      const subtitleParts = [];
      if (titleAr) subtitleParts.push(titleAr);
      if (sourceName) subtitleParts.push(`Source: ${sourceName}`);
      
      return {
        title: title || 'Untitled',
        subtitle: subtitleParts.join(' • '), // Show Arabic title and source name
        media: previewMedia,
      }
    },
  },
  orderings: [
    {
      title: 'Date Added (Newest)',
      name: 'createdAtDesc',
      by: [{ field: '_createdAt', direction: 'desc' }],
    },
    {
      title: 'Date Added (Oldest)',
      name: 'createdAtAsc',
      by: [{ field: '_createdAt', direction: 'asc' }],
    },
    {
      title: 'Published Date (Latest)',
      name: 'publishedAtDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
    {
      title: 'Published Date (Oldest)',
      name: 'publishedAtAsc',
      by: [{ field: 'publishedAt', direction: 'asc' }],
    },
    {
      title: 'Last Edited (Recent)',
      name: 'updatedAtDesc',
      by: [{ field: '_updatedAt', direction: 'desc' }],
    },
    {
      title: 'Last Edited (Oldest)',
      name: 'updatedAtAsc',
      by: [{ field: '_updatedAt', direction: 'asc' }],
    },
  ],
})

