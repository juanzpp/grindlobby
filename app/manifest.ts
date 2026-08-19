import type {MetadataRoute} from "next";
export default function manifest():MetadataRoute.Manifest{return{name:"GrindLobby",short_name:"GrindLobby",description:"Your squad. Your lobby. Your grind.",start_url:"/",display:"standalone",background_color:"#08080d",theme_color:"#8b5cf6",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml"}]}}
