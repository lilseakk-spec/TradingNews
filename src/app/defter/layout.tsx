import type { Metadata } from "next";
import Shell from "@/components/defter/Shell";

export const metadata: Metadata = {
  title: "Defter — trade günlüğü ve fon yönetimi",
  description:
    "İşlem kaydı, fon hesapları, kasa muhasebesi, görsel playbook ve yapay zeka analizi tek ekranda.",
};

export default function DefterLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
