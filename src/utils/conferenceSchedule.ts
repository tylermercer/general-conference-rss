export interface ConferenceYearMonth {
  year: number;
  month: number;
}

export interface ConferenceWeekend {
  saturday: Date;
  sunday: Date;
}

/**
 * Returns the Saturday and Sunday dates for the General Conference of the given year/month.
 * General Conference is held on the first Saturday and Sunday of April (month 4) and October (month 10).
 */
export function getConferenceWeekend(year: number, month: number): ConferenceWeekend {
  // Find the first day of the specified month
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const dayOfWeek = firstOfMonth.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Calculate day of the month for the first Saturday
  const saturdayDay = 1 + ((6 - dayOfWeek + 7) % 7);
  const saturday = new Date(Date.UTC(year, month - 1, saturdayDay, 0, 0, 0, 0));
  const sunday = new Date(Date.UTC(year, month - 1, saturdayDay + 1, 0, 0, 0, 0));

  return { saturday, sunday };
}

/**
 * Returns the year and month of the next General Conference following the given conference.
 * (April -> October of same year; October -> April of next year).
 */
export function getNextConference(year: number, month: number): ConferenceYearMonth {
  if (month === 4) {
    return { year, month: 10 };
  }
  return { year: year + 1, month: 4 };
}

export interface ScheduledTalk<T> {
  talk: T;
  pubDate: Date;
}

/**
 * Given all talks for one conference in broadcast order, schedules deterministic pubDates evenly across
 * the pacing window [windowStart, windowEnd).
 *
 * windowStart = conference Sunday + 7 days
 * windowEnd = next conference Saturday
 */
export function schedulePubDates<T>(talks: T[], conferenceYear: number, conferenceMonth: number): ScheduledTalk<T>[] {
  if (!talks || talks.length === 0) {
    return [];
  }

  const weekend = getConferenceWeekend(conferenceYear, conferenceMonth);
  const windowStart = new Date(weekend.sunday.getTime() + 7 * 24 * 60 * 60 * 1000);

  const nextConf = getNextConference(conferenceYear, conferenceMonth);
  const nextWeekend = getConferenceWeekend(nextConf.year, nextConf.month);
  const windowEnd = nextWeekend.saturday;

  const totalDuration = windowEnd.getTime() - windowStart.getTime();
  const step = totalDuration / talks.length;

  return talks.map((talk, index) => {
    const pubDate = new Date(windowStart.getTime() + Math.floor(index * step));
    return {
      talk,
      pubDate,
    };
  });
}

/**
 * Given talks for the most recent conference in broadcast order, schedules deterministic pubDates evenly across
 * the catch-up window [startDate, windowEnd).
 *
 * windowStart = startDate
 * windowEnd = next conference Saturday
 */
export function scheduleCatchUpPubDates<T>(
  talks: T[],
  conferenceYear: number,
  conferenceMonth: number,
  startDate: Date
): ScheduledTalk<T>[] {
  if (!talks || talks.length === 0) {
    return [];
  }

  const windowStart = startDate;

  const nextConf = getNextConference(conferenceYear, conferenceMonth);
  const nextWeekend = getConferenceWeekend(nextConf.year, nextConf.month);
  const windowEnd = nextWeekend.saturday;

  const totalDuration = windowEnd.getTime() - windowStart.getTime();
  if (totalDuration <= 0) {
    return talks.map((talk) => ({
      talk,
      pubDate: new Date(windowStart.getTime()),
    }));
  }

  const step = totalDuration / talks.length;

  return talks.map((talk, index) => {
    const pubDate = new Date(windowStart.getTime() + Math.floor(index * step));
    return {
      talk,
      pubDate,
    };
  });
}
