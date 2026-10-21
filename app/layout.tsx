import type { Metadata } from "next";
import "./styles.css";
export const metadata: Metadata = { title: "NPC Roasted. | Character reports", description: "Pick an NPC or PC. Get a roast based on its artwork and a card to keep. No wallet needed." };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
