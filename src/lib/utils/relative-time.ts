import { formatDistanceToNowStrict } from 'date-fns';

// Format a Unix-ms timestamp as a relative string, e.g. "2 hours ago".
export function relativeTime(timestamp: number): string {
    return formatDistanceToNowStrict(timestamp, { addSuffix: true });
}
