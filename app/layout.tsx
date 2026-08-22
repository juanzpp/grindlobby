import "./globals.css";
import "./lovable.css";
import "./desktop-runtime.css";
import "./mobile-responsive.css";
import "./mobile-audit-overrides.css";
import type {Metadata,Viewport} from "next";
import PersistentCallDock from "@/components/PersistentCallDock";
import DesktopRuntimeMode from "@/components/DesktopRuntimeMode";

export const metadata:Metadata={title:{default:"GrindLobby",template:"%s · GrindLobby"},description:"Rank, lobbies, voz e transmissão para jogadores competitivos.",manifest:"/manifest.webmanifest"};
export const viewport:Viewport={themeColor:"#08080d",colorScheme:"dark",width:"device-width",initialScale:1,viewportFit:"cover"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body><DesktopRuntimeMode/>{children}<PersistentCallDock/></body></html>}
