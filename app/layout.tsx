import "./globals.css"; import type {Metadata,Viewport} from "next";
export const metadata:Metadata={title:{default:"GrindLobby",template:"%s · GrindLobby"},description:"Your squad. Your lobby. Your grind.",manifest:"/manifest.webmanifest"};
export const viewport:Viewport={themeColor:"#08080d",colorScheme:"dark"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
