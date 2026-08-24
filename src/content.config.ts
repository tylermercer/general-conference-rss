import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { getEligibleConferenceTalks } from './utils/fetchConferenceTalks.js';

export function conferenceTalksLoader() {
  return {
    name: 'conference-talks-loader',
    load: async ({ store, parseData, logger }: any) => {
      if (logger) {
        logger.info('Loading conference talks into collection...');
      }
      store.clear();
      const talks = await getEligibleConferenceTalks();
      for (const talk of talks) {
        const id = `${talk.conferenceYear}-${talk.conferenceMonth}-${talk.sessionSlug}`;
        const data = await parseData({ id, data: talk });
        store.set({ id, data });
      }
    },
  };
}

const talks = defineCollection({
  loader: conferenceTalksLoader(),
  schema: z.object({
    title: z.string(),
    speaker: z.string(),
    url: z.string(),
    sessionSlug: z.string(),
    conferenceYear: z.number(),
    conferenceMonth: z.number(),
    enclosureUrl: z.string().optional(),
  }),
});

export const collections = { talks };
