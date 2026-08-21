import "./globals.css";
import "./lovable.css";
import "./desktop-runtime.css";
import type {Metadata,Viewport} from "next";
import PersistentCallDock from "@/components/PersistentCallDock";
import DesktopRuntimeMode from "@/components/DesktopRuntimeMode";

export const metadata:Metadata={title:{default:"GrindLobby",template:"%s · GrindLobby"},description:"Rank, lobbies, voz e transmissão para jogadores competitivos.",manifest:"/manifest.webmanifest"};
export const viewport:Viewport={themeColor:"#08080d",colorScheme:"dark"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body><DesktopRuntimeMode/>{children}<PersistentCallDock/></body></html>}
