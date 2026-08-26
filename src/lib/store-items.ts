export type StoreItemKind = "border" | "title" | "banner";

export type StoreItem = {
  id: string;
  kind: StoreItemKind;
  name: string;
  desc: string;
  price: number;
  minLevel: number;
  ring?: string;
  shadow?: string;
  animated?: boolean;
  gradient?: string;
  label?: string;
};

export const STORE_ITEMS: StoreItem[] = [
  { id:"border-none",kind:"border",name:"Sem borda",desc:"Perfil limpo, padrão da conta",price:0,minLevel:0,ring:"oklch(0.35 0.02 285)" },
  { id:"border-steel",kind:"border",name:"Aço Escovado",desc:"Anel metálico duplo com brilho frio",price:250,minLevel:0,ring:"linear-gradient(135deg, oklch(0.78 0.02 250), oklch(0.42 0.02 250))",shadow:"0 0 14px oklch(0.78 0.02 250 / 0.35)" },
  { id:"border-neon",kind:"border",name:"Neon Violeta",desc:"Contorno neon com halo pulsante",price:480,minLevel:5,ring:"linear-gradient(135deg, oklch(0.62 0.24 300), oklch(0.78 0.2 310))",shadow:"0 0 22px oklch(0.66 0.24 302 / 0.6)",animated:true },
  { id:"border-emerald",kind:"border",name:"Circuito Esmeralda",desc:"Traço de circuito verde com pulso lento",price:620,minLevel:10,ring:"linear-gradient(135deg, oklch(0.62 0.16 160), oklch(0.8 0.16 155))",shadow:"0 0 20px oklch(0.7 0.16 158 / 0.5)",animated:true },
  { id:"border-crimson",kind:"border",name:"Selo Carmesim",desc:"Moldura fundida com brasa quente",price:850,minLevel:18,ring:"linear-gradient(135deg, oklch(0.58 0.22 18), oklch(0.75 0.2 30))",shadow:"0 0 24px oklch(0.62 0.22 20 / 0.6)",animated:true },
  { id:"border-prismatic",kind:"border",name:"Prisma Rotativo",desc:"Borda cromática giratória — exclusiva de elite",price:1500,minLevel:30,ring:"conic-gradient(from 0deg, oklch(0.7 0.2 320), oklch(0.75 0.18 250), oklch(0.8 0.18 160), oklch(0.85 0.17 90), oklch(0.7 0.2 320))",shadow:"0 0 30px oklch(0.75 0.19 300 / 0.65)",animated:true },
  { id:"title-none",kind:"title",name:"Sem título",desc:"Nenhuma tag ao lado do nome",price:0,minLevel:0,label:"" },
  { id:"title-grinder",kind:"title",name:'Título "Grinder"',desc:"Tag exibida ao lado do seu nick",price:200,minLevel:3,label:"GRINDER" },
  { id:"title-clutch",kind:"title",name:'Título "Clutch King"',desc:"Para quem decide no último lance",price:450,minLevel:12,label:"CLUTCH KING" },
  { id:"title-lenda",kind:"title",name:'Título "Lenda do Servidor"',desc:"Só para quem passou do level 35",price:1200,minLevel:35,label:"LENDA" },
  { id:"banner-none",kind:"banner",name:"Banner padrão",desc:"Fundo escuro simples",price:0,minLevel:0,gradient:"linear-gradient(120deg, oklch(0.12 0.02 288), oklch(0.09 0.01 285))" },
  { id:"banner-void",kind:"banner",name:"Banner Vazio Roxo",desc:"Névoa violeta com profundidade",price:300,minLevel:0,gradient:"linear-gradient(120deg, oklch(0.22 0.1 300), oklch(0.09 0.02 285))" },
  { id:"banner-aurora",kind:"banner",name:"Banner Aurora",desc:"Degradê aurora animado no topo do perfil",price:700,minLevel:15,gradient:"linear-gradient(120deg, oklch(0.3 0.14 300), oklch(0.28 0.12 200), oklch(0.1 0.02 285))" },
];

export const STORE_TABS: { id: StoreItemKind; label: string }[] = [
  { id:"border",label:"Bordas" },
  { id:"title",label:"Títulos" },
  { id:"banner",label:"Banners" },
];
