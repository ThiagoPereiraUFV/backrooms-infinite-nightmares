import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "Backrooms - Infinite Nightmares",
  description:
    "You noclipped out of reality. Explore infinite procedurally generated backrooms levels — if you don't hear the fluorescent hum, run.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Backrooms",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0b07",
  width: "device-width",
  initialScale: 1,
  // Lets env(safe-area-inset-*) resolve to real values on notched devices.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <div className="filmOverlay" aria-hidden="true" />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
