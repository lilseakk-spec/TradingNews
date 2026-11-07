import type { NextConfig } from "next";

/**
 * Statik site olarak kurulur: `next build` out/ klasorunu uretir, GitHub
 * Pages onu yayinlar. Veri dosyalari depoda durdugu icin sayfalar kurulum
 * aninda uretilir; yeni hafta push edildiginde site kendini yeniler.
 *
 * NEXT_PUBLIC_BASE_PATH, proje sayfalarinda deponun adidir (/sismograf).
 * Yerelde bos kalir, boylece localhost:3000 oldugu gibi calisir.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
