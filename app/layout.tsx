import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title: "Knight Club — Chess for two", description: "Play chess together on one screen or invite a friend to your own online chess room.", icons: {icon: "/favicon.svg"}};
export default function RootLayout({children}: {children: React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`try{document.documentElement.dataset.theme=localStorage.getItem("kc-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch{}`}}/></head><body>{children}</body></html>;
}
