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
    year: z.number().nullable().optional(),
    endYear: z.union([z.number(), z.string()]).nullable().optional(),
    type: z.array(z.string()).nullable().optional(),
    coverImage: z.string().optional(),
    collaborators: z.array(z.string()).optional(),
    description: z.string().optional(),
    hideFromIndex: z.boolean().default(false),
    priority: z.number().default(1),
  }),
});


const curation = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/curation' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().nullable().optional(),
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
    date: z.coerce.date().nullable().optional(),
  }),
});

const texts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/texts' }),
  schema: z.object({
    title: z.string(),
    author: z.string().optional(),
    date: z.coerce.date().nullable().optional(),
  }),
});

const interviews = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/interviews' }),
  schema: z.object({
    title: z.string(),
    interviewee: z.string().optional(),
    date: z.coerce.date().nullable().optional(),
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
    date: z.coerce.date().nullable().optional(),
    location: z.string().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().nullable().optional(),
    category: z.string().nullable().optional(),
    skin: z.string().optional(),
    author: z.string().nullable().optional(),
    coverImage: z.string().optional(),
    hideFromIndex: z.boolean().default(false),
  }),
});

export const collections = { people, works, curation, software, curriculum, texts, interviews, events, blog };
