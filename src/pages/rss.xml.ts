import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getEligibleConferenceTalks, type ConferenceTalk } from '../utils/fetchConferenceTalks.js';
import { schedulePubDates, type ScheduledTalk } from '../utils/conferenceSchedule.js';

export const GET: APIRoute = async ({ site }) => {
  const buildTime = new Date();
  const talks = await getEligibleConferenceTalks(buildTime);

  // Group talks by conference (year & month)
  const talksByConference = new Map<string, ConferenceTalk[]>();
  for (const talk of talks) {
    const key = `${talk.conferenceYear}-${talk.conferenceMonth}`;
    if (!talksByConference.has(key)) {
      talksByConference.set(key, []);
    }
    talksByConference.get(key)!.push(talk);
  }

  // Schedule pubDates for each conference's talks
  const scheduledTalks: ScheduledTalk<ConferenceTalk>[] = [];
  for (const [key, confTalks] of talksByConference.entries()) {
    const [yearStr, monthStr] = key.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const scheduled = schedulePubDates(confTalks, year, month);
    scheduledTalks.push(...scheduled);
  }

  // Drip feed filter: include only items whose scheduled pubDate <= buildTime
  const releasedTalks = scheduledTalks.filter((item) => item.pubDate <= buildTime);

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
    title: 'General Conference Talks',
    description: 'Drip feed RSS release of LDS General Conference talks.',
    site: siteUrl,
    items,
  });
};
