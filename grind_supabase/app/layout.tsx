import "./globals.css"; import type {Metadata} from "next";
export const metadata:Metadata={title:"GrindLobby",description:"Your squad. Your lobby. Your grind."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}