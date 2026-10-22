import type { Metadata, Viewport } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/montserrat/600.css";
import "./globals.css";
import PwaRegister from "@/components/pwa-register";

export const viewport: Viewport = {
  themeColor: "#091012",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Portrait Studio",
  description: "Create a professional event poster in minutes.",
  applicationName: "Portrait Studio",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Portrait Studio",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
