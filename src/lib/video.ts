/**
 * What the browser can tell about a video before it is sent anywhere. A
 * tape's length is read from its metadata alone, so a file over the limit is
 * refused at selection rather than after two hundred megabytes have crossed
 * a phone connection.
 */
export function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

/** "30 seconds", "1 minute 30 seconds", "2 minutes". */
export function formatSeconds(total: number): string {
  const seconds = Math.round(total);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const parts: string[] = [];
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (rest || !minutes) parts.push(`${rest} ${rest === 1 ? "second" : "seconds"}`);
  return parts.join(" ");
}
