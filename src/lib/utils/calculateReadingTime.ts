function calculateReadingTime(
    wordCount: number,
    wordsPerMinute: number = 238
): { minutes: number; display: string } {
    const totalMinutes = wordCount / wordsPerMinute;

    if (totalMinutes < 1) {
        const seconds = Math.ceil(totalMinutes * 60);
        return {
            minutes: totalMinutes,
            display: `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
        };
    }

    if (totalMinutes < 60) {
        const minutes = Math.ceil(totalMinutes);
        return {
            minutes,
            display: `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
        };
    }

    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.ceil(totalMinutes % 60);
    const hourPart = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    const minutePart =
        remainingMinutes > 0
            ? `${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}`
            : '';

    return {
        minutes: totalMinutes,
        display: `${hourPart} ${minutePart}`.trim()
    };
}

export default calculateReadingTime;
