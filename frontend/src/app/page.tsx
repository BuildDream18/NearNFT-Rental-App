import type { Metadata } from "next";
import dynamic from "next/dynamic";

const LandingPage = dynamic(() => import("@/components/Landing"), { ssr: false })

export const metadata: Metadata = {
  title: "Mintbase Simple Marketplace Example",
  description: "Simple Marketplace",
  openGraph: {
    images: ['https://i.imgur.com/FjcUss9.png']
  }
};

export default function Home() {
  return (
    <main className="px-2 sm:px-8 md:px-24 py-12">
      <LandingPage />
    </main>
  );
}
