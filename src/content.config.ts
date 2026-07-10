// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const people = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/people' }),
  schema: z.object({
    name: z.string(),
    role: z.string().optional(),
    url: z.string().optional(),
    bio: z.string().optional(),
    photo: z.string().optional(),
  }),
});

const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: z.object({
    title: z.string(),
    year: z.number().optional(),
    coverImage: z.string().optional(),
    collaborators: z.array(z.string()).optional(),
    description: z.string().optional(),
    hideFromIndex: z.boolean().default(false),
    priority: z.number().default(1),
  }),
});

const performances = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/performances' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
    location: z.string().optional(),
    coverImage: z.string().optional(),
    hideFromIndex: z.boolean().default(false),
    priority: z.number().default(1),
  }),
});

const curation = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/curation' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
    coverImage: z.string().optional(),
    hideFromIndex: z.boolean().default(false),
    priority: z.number().default(1),
  }),
});

const software = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/software' }),
  schema: z.object({
    title: z.string(),
    coverImage: z.string().optional(),
    repoUrl: z.string().optional(),
    description: z.string().optional(),
    hideFromIndex: z.boolean().default(false),
    priority: z.number().default(1),
  }),
});

const curriculum = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/curriculum' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
  }),
});

const texts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/texts' }),
  schema: z.object({
    title: z.string(),
    author: z.string().optional(),
    date: z.coerce.date().optional(),
  }),
});

const interviews = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/interviews' }),
  schema: z.object({
    title: z.string(),
    interviewee: z.string().optional(),
    date: z.coerce.date().optional(),
    entryType: z.enum(['interview']).optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    dateText: z.string().optional(),
    transcriptType: z.enum(['none', 'wiki', 'url']).optional(),
    transcriptTarget: z.string().optional(),
    transcriptLabel: z.string().optional(),
    audioFiles: z.array(z.object({
      label: z.string(),
      url: z.string(),
    })).optional(),
    priority: z.number().default(1),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
    location: z.string().optional(),
  }),
});

export const collections = { people, works, performances, curation, software, curriculum, texts, interviews, events };
