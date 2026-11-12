import Kokpit, { type WeekBrief } from "@/components/defter/Kokpit";
import { currentWeek, todayISO } from "@/lib/store";

/**
 * Kokpit. Takvim tarafindan gelen tek sey haftanin yuksek etkili
 * haberleri: islem gunu planlanirken risk penceresi gorunsun diye.
 */
export default function DefterHome() {
  const week = currentWeek(todayISO());

  const brief: WeekBrief | null = week
    ? {
        id: week.id,
        label: week.label,
        preliminary: Boolean(week.preliminary),
        thesis: week.ai?.thesis ?? "",
        events: week.days
          .flatMap((day) => day.events.map((event) => ({ ...event, date: day.date })))
          .filter((event) => event.impact === 3)
          .slice(0, 8)
          .map((event) => ({
            id: event.id,
            date: event.date,
            time: event.time ?? "",
            title: event.title,
            region: event.region,
          })),
      }
    : null;

  return <Kokpit brief={brief} />;
}
