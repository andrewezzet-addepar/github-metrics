export function getTodayMinusDays(days: number = 0): string {
  let date = new Date();
  date.setDate(date.getDate() - days);
  return toDateInputFormat(date.toDateString());
}

function toDateInputFormat(dateString: string): string {
  let date = new Date(dateString);
  let m = date.getMonth() + 1;
  let d = date.getDate();
  let y = date.getFullYear();
  return `${y}-${(m < 10 ? '0' : '') + m}-${(d < 10 ? '0' : '') + d}`;
}

export function formatDate(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}

export function toFixed(maxDecimals: number, value: number): string {
  let charsAfterDecimal = value.toString().split('.')[1];
  let decimals = charsAfterDecimal ? Math.max(0, charsAfterDecimal.length) : 0;
  return value.toFixed(Math.min(decimals, maxDecimals));
}

export function diffSummary(add: number, del: number): string {
  if (isNaN(add) || isNaN(del)) {
    return 'N/A';
  }
  return `${toFixed(0, add + del)}&nbsp;(+${toFixed(0, add)}/-${toFixed(0, del)})`;
}

export function humanizeDuration(millis: number): string {
  if (isNaN(millis)) {
    return 'N/A';
  }

  let [value, unit] = [millis / 1000 / 60 / 60, 'hours'];

  return `${toFixed(1, value)} ${unit}`;
}
