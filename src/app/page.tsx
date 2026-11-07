import { currentWeek, todayISO, weekIndex } from "@/lib/store";
import WeekScreen from "@/components/WeekScreen";
import EmptyWeek from "@/components/EmptyWeek";

function navLabel(id: string): string {
  const week = Number(id.split("-W")[1]);
  return `${week}. hafta`;
}

export default function Home() {
  // Kurulum anindaki tarih yalnizca hangi haftanin acilacagini secer.
  const today = todayISO();
  const week = currentWeek(today);

  if (!week) return <EmptyWeek today={today} />;

  const index = weekIndex();
  const at = index.findIndex((w) => w.id === week.id);
  const older = at >= 0 ? index[at + 1] : undefined;
  const newer = at > 0 ? index[at - 1] : undefined;

  return (
    <WeekScreen
      week={week}
      prev={older ? { id: older.id, label: navLabel(older.id) } : undefined}
      next={newer ? { id: newer.id, label: navLabel(newer.id) } : undefined}
    />
  );
}
