import { notFound } from "next/navigation";
import { loadWeek, weekIndex } from "@/lib/store";
import WeekScreen from "@/components/WeekScreen";

/** Arsivdeki her hafta kurulum aninda kendi sayfasi olarak uretilir. */
export function generateStaticParams() {
  return weekIndex().map((w) => ({ id: w.id }));
}

export const dynamicParams = false;

function navLabel(id: string): string {
  return `${Number(id.split("-W")[1])}. hafta`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const week = loadWeek(id);
  return { title: week ? `${week.label} — Sismograf` : "Hafta bulunamadı" };
}

export default async function WeekPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const week = loadWeek(id);
  if (!week) notFound();

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
