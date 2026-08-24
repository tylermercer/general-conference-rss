import * as cheerio from 'cheerio';
import { getConferenceWeekend } from './conferenceSchedule.js';

export interface ConferenceTalk {
  title: string;
  speaker: string;
  url: string;
  sessionSlug: string;
  conferenceYear: number;
  conferenceMonth: number;
  enclosureUrl?: string;
}

export interface CandidateConference {
  year: number;
  month: number;
}

const CHURCH_BASE_URL = 'https://www.churchofjesuschrist.org';

/**
 * Fetches the main General Conference collection page and returns candidate conferences
 * matching /study/general-conference/(\d{4})/(\d{2}) where year >= 2026.
 */
export async function fetchCandidateConferences(): Promise<CandidateConference[]> {
  const collectionUrl = `${CHURCH_BASE_URL}/study/general-conference?lang=eng`;
  const response = await fetch(collectionUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch conference collection from ${collectionUrl}: ${response.statusText}`);
  }
  const html = await response.text();

  const matches = [...html.matchAll(/\/study\/general-conference\/(\d{4})\/(\d{2})/g)];
  const candidates: CandidateConference[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const key = `${year}-${month}`;

    if (year >= 2026 && !seen.has(key)) {
      seen.add(key);
      candidates.push({ year, month });
    }
  }

  return candidates;
}

/**
 * Checks if a candidate conference is eligible based on current date.
 * Eligible only if at least one week (7 days) has passed since the conference Sunday.
 */
export function isConferenceEligible(conf: CandidateConference, now: Date = new Date()): boolean {
  const weekend = getConferenceWeekend(conf.year, conf.month);
  const eligibilityDate = new Date(weekend.sunday.getTime() + 7 * 24 * 60 * 60 * 1000);
  return now >= eligibilityDate;
}

/**
 * Fetches the contents page for an eligible conference and extracts talks in broadcast order.
 */
export async function fetchTalksForConference(year: number, month: number): Promise<ConferenceTalk[]> {
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const contentsUrl = `${CHURCH_BASE_URL}/study/general-conference/${year}/${monthStr}?lang=eng`;
  const response = await fetch(contentsUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch conference contents from ${contentsUrl}: ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const talks: ConferenceTalk[] = [];
  const seenUrls = new Set<string>();

  // Find all anchor links pointing to talks in this conference
  const confPathPrefix = `/study/general-conference/${year}/${monthStr}/`;

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || !href.includes(confPathPrefix)) {
      return;
    }

    // Normalize path
    const urlObj = new URL(href, CHURCH_BASE_URL);
    const pathname = urlObj.pathname;
    const slug = pathname.substring(confPathPrefix.length).replace(/\/$/, '');

    // Skip empty or session wrapper links
    if (!slug || slug.endsWith('-session')) {
      return;
    }

    const fullTalkUrl = `${CHURCH_BASE_URL}${pathname}?lang=eng`;

    if (seenUrls.has(fullTalkUrl)) {
      return;
    }

    // Extract title and speaker from paragraphs inside the anchor tag
    const paragraphs: string[] = [];
    $(el).find('p').each((_, p) => {
      const text = $(p).text().trim();
      if (text) {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length === 0) {
      return;
    }

    const title = paragraphs[0];
    const speaker = paragraphs.length > 1 ? paragraphs[1] : '';

    // Exclude Sustaining of Officers and Church Auditing Department Report
    const lowerTitle = title.toLowerCase();
    if (
      lowerTitle.startsWith('sustaining of') ||
      lowerTitle.includes('church auditing department report')
    ) {
      return;
    }

    // TODO(audio): In a future pass, perform a per-talk fetch to inspect the "Download" menu / audio enclosure element
    // and populate enclosureUrl.
    const enclosureUrl: string | undefined = undefined;

    seenUrls.add(fullTalkUrl);
    talks.push({
      title,
      speaker,
      url: fullTalkUrl,
      sessionSlug: slug,
      conferenceYear: year,
      conferenceMonth: month,
      enclosureUrl,
    });
  });

  return talks;
}

/**
 * High-level utility function to fetch talks from all eligible General Conferences.
 * Returns an array of talks ordered by conference, then broadcast order.
 * Handles errors gracefully by logging warnings and returning an empty list on failure.
 */
export async function getEligibleConferenceTalks(now: Date = new Date()): Promise<ConferenceTalk[]> {
  try {
    const candidates = await fetchCandidateConferences();
    const eligible = candidates.filter((conf) => isConferenceEligible(conf, now));

    // Sort conferences ascending (older first, so chronological broadcast order)
    eligible.sort((a, b) => a.year - b.year || a.month - b.month);

    const allTalks: ConferenceTalk[] = [];
    for (const conf of eligible) {
      const confTalks = await fetchTalksForConference(conf.year, conf.month);
      allTalks.push(...confTalks);
    }

    return allTalks;
  } catch (err) {
    console.warn('Warning: Failed to fetch eligible conference talks:', err);
    return [];
  }
}
