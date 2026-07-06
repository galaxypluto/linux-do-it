export function compactNumber(value: number): string {
  if (value >= 1000000) {
    return `${trim(value / 1000000)}m`;
  }
  if (value >= 1000) {
    return `${trim(value / 1000)}k`;
  }
  return String(value);
}

export function relativeTime(iso: string): string {
  if (!iso) {
    return "";
  }
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "";
  }

  const diff = Date.now() - then;
  const minutes = Math.max(Math.floor(diff / 60000), 0);
  if (minutes < 1) {
    return "刚刚";
  }
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} 小时`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} 天`;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric"
  }).format(new Date(iso));
}

export type PublishTimeFormatOptions = {
  locale?: string;
  timeZone?: string;
};

export function formatPublishTime(iso: string, options: PublishTimeFormatOptions = {}): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const now = new Date();
  const timeZone = resolvedPublishTimeZone(options.timeZone);
  const thenDate = calendarDateParts(then, timeZone);
  const nowDate = calendarDateParts(now, timeZone);
  const diffDays = diffCalendarDays(thenDate, nowDate);

  if (diffDays <= 0) {
    return "今天发布";
  }
  if (diffDays <= 7) {
    return `${diffDays}天前发布`;
  }

  return `${thenDate.year}-${padCalendarPart(thenDate.month)}-${padCalendarPart(thenDate.day)} 发布`;
}

function trim(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}

type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

function resolvedPublishTimeZone(timeZone?: string): string | undefined {
  if (timeZone) {
    return timeZone;
  }
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function calendarDateParts(date: Date, timeZone?: string): CalendarDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric"
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
    return { year, month, day };
  }

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  };
}

function diffCalendarDays(thenDate: CalendarDateParts, nowDate: CalendarDateParts): number {
  const thenTime = Date.UTC(thenDate.year, thenDate.month - 1, thenDate.day);
  const nowTime = Date.UTC(nowDate.year, nowDate.month - 1, nowDate.day);
  return Math.floor((nowTime - thenTime) / (1000 * 60 * 60 * 24));
}

function padCalendarPart(value: number): string {
  return String(value).padStart(2, "0");
}
