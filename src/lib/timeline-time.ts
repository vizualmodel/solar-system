// Omit timeZone so the browser uses the user's timezone, including DST.
export function localTimelineTime(ms: number): string {
 return new Date(ms).toLocaleString('en-GB', {
  day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',
  hourCycle:'h23',timeZoneName:'shortOffset',
 });
}
