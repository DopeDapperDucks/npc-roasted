import type { Metadata } from "next";
import "./styles.css";
export const metadata: Metadata = { title: "NPC ROASTED | Your NFT deserves this", description: "Get your NFT absolutely cooked. Free, no wallet required." };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
