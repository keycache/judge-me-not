import { buildHumanFriendlySessionId } from '@/lib/interview-rules';

export interface SessionIdentity {
  id: string;
  title: string;
}

function toTitleCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildSessionIdentity(sessionNameFromModel: string, timestamp: Date = new Date()): SessionIdentity {
  const title = toTitleCase(sessionNameFromModel) || 'Interview Session';
  return {
    id: buildHumanFriendlySessionId(title, timestamp),
    title,
  };
}
