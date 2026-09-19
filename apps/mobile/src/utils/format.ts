export function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function lowerFirst(text: string): string {
  return text.length ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

export function formatTimeLabel(iso: string): string {
  const date = new Date(iso);
  const minutes = date.getMinutes();
  return date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: minutes === 0 ? undefined : '2-digit' })
    .replace(' ', ' ');
}
