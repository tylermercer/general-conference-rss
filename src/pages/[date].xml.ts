import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import type { ConferenceTalk } from '../utils/fetchConferenceTalks.js';
import { schedulePubDates, scheduleCatchUpPubDates, type ScheduledTalk } from '../utils/conferenceSchedule.js';

export const prerender = false;

export const GET: APIRoute = async ({ params, site }) => {
  const dateStr = params.date;
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Response('Invalid date format. Expected YYYY-MM-DD.', { status: 400 });
  }

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Basic calendar month/day range validation
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return new Response('Invalid date.', { status: 400 });
  }

  const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (isNaN(startDate.getTime()) || startDate.getUTCMonth() !== month - 1 || startDate.getUTCDate() !== day) {
    return new Response('Invalid date.', { status: 400 });
  }

  const requestTime = new Date();
  const talkEntries = await getCollection('talks');
  const talks = talkEntries.map((entry) => entry.data);

  // Group talks by conference (year & month)
  const talksByConference = new Map<string, { year: number; month: number; talks: ConferenceTalk[] }>();
  for (const talk of talks) {
    const key = `${talk.conferenceYear}-${talk.conferenceMonth}`;
    if (!talksByConference.has(key)) {
      talksByConference.set(key, { year: talk.conferenceYear, month: talk.conferenceMonth, talks: [] });
    }
    talksByConference.get(key)!.talks.push(talk);
  }

  // Find the most recent conference session
  let maxKey: string | null = null;
  let maxYear = -1;
  let maxMonth = -1;

  for (const [key, group] of talksByConference.entries()) {
    if (group.year > maxYear || (group.year === maxYear && group.month > maxMonth)) {
      maxYear = group.year;
      maxMonth = group.month;
      maxKey = key;
    }
  }

  // Schedule pubDates for each conference's talks
  const scheduledTalks: ScheduledTalk<ConferenceTalk>[] = [];
  for (const [key, group] of talksByConference.entries()) {
    if (key === maxKey) {
      const scheduled = scheduleCatchUpPubDates(group.talks, group.year, group.month, startDate);
      scheduledTalks.push(...scheduled);
    } else {
      const scheduled = schedulePubDates(group.talks, group.year, group.month);
      scheduledTalks.push(...scheduled);
    }
  }

  // Drip feed filter: include only items whose scheduled pubDate <= requestTime
  const releasedTalks = scheduledTalks.filter((item) => item.pubDate <= requestTime);

  // Sort released items newest-first
  releasedTalks.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  // Build RSS feed items
  const items = releasedTalks.map(({ talk, pubDate }) => {
    const titleText = talk.speaker ? `${talk.title} - ${talk.speaker}` : talk.title;
    return {
      title: titleText,
      description: talk.speaker ? `Talk by ${talk.speaker}` : talk.title,
      link: talk.url,
      pubDate,
      customData: `<guid isPermaLink="true">${talk.url}</guid>`,
      enclosure: talk.enclosureUrl
        ? {
            url: talk.enclosureUrl,
            type: 'audio/mpeg',
            length: 0,
          }
        : undefined,
    };
  });

  const siteUrl = site ? site.toString() : 'https://example.com/';

  return rss({
    title: 'General Conference Talks (Catch-Up)',
    description: `Catch-up drip feed RSS release of LDS General Conference talks starting from ${dateStr}.`,
    site: siteUrl,
    items,
  });
};
