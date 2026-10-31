// 日時の変換。保存は ISO 8601（UTC）、入力欄は端末のローカル時刻で扱う

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromLocalInput = (value: string) => new Date(value).toISOString();

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const year = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}/` : '';
  return `${year}${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDate(date: string) {
  const [y, m, d] = date.slice(0, 10).split('-');
  return `${y}/${Number(m)}/${Number(d)}`;
}

// 日付（YYYY-MM-DD または ISO）から今日までの日数
export function daysSince(date: string, now = new Date()) {
  const d = date.length === 10 ? new Date(`${date}T00:00:00`) : new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}
