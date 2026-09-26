import * as m from '$lib/paraglide/messages';

// Decimal units, 1 KB = 1000 bytes: what Finder and Windows Explorer show, so
// the number here matches the one the writer sees in their own folder.
const KB = 1000;
const MB = KB * KB;

// The number only. Intl's own `unit` style prints "kB", the SI spelling, where
// both file managers say "KB" — so the unit is copy, in the messages.
const kilobytes = new Intl.NumberFormat('en');
const megabytes = new Intl.NumberFormat('en', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
});

// A file's size for the Files screen: "Empty", "4 KB", "1.4 MB".
//
// Kilobytes round up, so a file with anything in it never reads as "0 KB" —
// and a file one byte short of a megabyte, which would round up to "1000 KB",
// reads as the megabyte it nearly is.
export function formatFileSize(bytes: number): string {
    if (bytes <= 0) return m.files_size_empty();

    const kb = Math.ceil(bytes / KB);
    if (kb < KB) return m.files_size_kb({ size: kilobytes.format(kb) });

    return m.files_size_mb({
        size: megabytes.format(Math.max(bytes, MB) / MB)
    });
}
