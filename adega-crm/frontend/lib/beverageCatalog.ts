export type BeverageCatalogItem={name:string;category:string;volumeMl:number;sku:string;image:string};

const photo=(id:string)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=420&h=620&q=88`;

export const beverageCatalog:BeverageCatalogItem[]=[
  {name:"Johnnie Walker Red Label",category:"Whisky",volumeMl:1000,sku:"JWRED1L",image:"https://toppng.com/public/uploads/preview/johnnie-walker-red-label-johnnie-walker-red-label-1-l-bottle-1156317189086tlxxleuj.png"},
  {name:"Jack Daniel's Old No. 7",category:"Whisky",volumeMl:1000,sku:"JD1L",image:photo("photo-1527281400683-1aae777175f8")},
  {name:"Chivas Regal 12 anos",category:"Whisky",volumeMl:1000,sku:"CHIVAS1L",image:photo("photo-1569529465841-dfecdab7503b")},
  {name:"Absolut Original",category:"Vodka",volumeMl:750,sku:"ABS750",image:photo("photo-1608885898957-a5598a5ae1d1")},
  {name:"Smirnoff Nº 21",category:"Vodka",volumeMl:998,sku:"SMI998",image:photo("photo-1615887023516-9b47d38427e9")},
  {name:"Tanqueray London Dry",category:"Gin",volumeMl:750,sku:"TANQ750",image:photo("photo-1606767341197-b56c0c7373c9")},
  {name:"Bombay Sapphire",category:"Gin",volumeMl:750,sku:"BOMB750",image:photo("photo-1584916201218-f4242ceb4809")},
  {name:"Campari",category:"Destilados",volumeMl:750,sku:"CAMP750",image:photo("photo-1551538827-9c037cb4f32a")},
  {name:"Heineken Long Neck",category:"Cervejas",volumeMl:330,sku:"HEI330",image:photo("photo-1515003197210-e0cd71810b5f")},
  {name:"Budweiser Long Neck",category:"Cervejas",volumeMl:330,sku:"BUD330",image:photo("photo-1608270586620-248524c67de9")},
  {name:"Corona Extra",category:"Cervejas",volumeMl:330,sku:"COR330",image:photo("photo-1505075106905-fb052892c116")},
  {name:"Skol Pilsen",category:"Cervejas",volumeMl:350,sku:"SK350",image:photo("photo-1535958636474-b021ee887b13")},
  {name:"Vinho Tinto Cabernet Sauvignon",category:"Vinhos",volumeMl:750,sku:"VINHCAB750",image:photo("photo-1510812431401-41d2bd2722f3")},
  {name:"Vinho Branco Chardonnay",category:"Vinhos",volumeMl:750,sku:"VINHCHA750",image:photo("photo-1473973266408-ed4e27abdd47")},
  {name:"Espumante Brut",category:"Espumantes",volumeMl:750,sku:"ESPBRUT750",image:photo("photo-1547595628-c61a29f496f0")},
  {name:"Red Bull",category:"Energéticos",volumeMl:250,sku:"RB250",image:photo("photo-1622543925917-763c34d1a86e")},
  {name:"Coca-Cola",category:"Refrigerantes",volumeMl:2000,sku:"COCA2L",image:photo("photo-1554866585-cd94860890b7")},
  {name:"Água Tônica",category:"Não alcoólicos",volumeMl:350,sku:"TON350",image:photo("photo-1544145945-f90425340c7e")},
  {name:"Jameson Irish Whiskey",category:"Whisky",volumeMl:750,sku:"JAM750",image:photo("photo-1569529465841-dfecdab7503b")},
  {name:"Ballantine's Finest",category:"Whisky",volumeMl:1000,sku:"BALL1L",image:photo("photo-1527281400683-1aae777175f8")},
  {name:"José Cuervo Especial",category:"Tequila",volumeMl:750,sku:"CUERVO750",image:photo("photo-1615887023516-9b47d38427e9")},
  {name:"Bacardi Carta Blanca",category:"Rum",volumeMl:980,sku:"BAC980",image:photo("photo-1584916201218-f4242ceb4809")},
  {name:"Cachaça 51",category:"Cachaças",volumeMl:965,sku:"C51965",image:photo("photo-1551538827-9c037cb4f32a")},
  {name:"Jägermeister",category:"Licores",volumeMl:700,sku:"JAGER700",image:photo("photo-1606767341197-b56c0c7373c9")},
  {name:"Baileys Original",category:"Licores",volumeMl:750,sku:"BAIL750",image:photo("photo-1551538827-9c037cb4f32a")},
  {name:"Stella Artois Long Neck",category:"Cervejas",volumeMl:330,sku:"STELLA330",image:photo("photo-1608270586620-248524c67de9")},
  {name:"Brahma Duplo Malte",category:"Cervejas",volumeMl:350,sku:"BRAH350",image:photo("photo-1535958636474-b021ee887b13")},
  {name:"Monster Energy",category:"Energéticos",volumeMl:473,sku:"MON473",image:photo("photo-1622543925917-763c34d1a86e")},
  {name:"Guaraná Antarctica",category:"Refrigerantes",volumeMl:2000,sku:"GUA2L",image:photo("photo-1554866585-cd94860890b7")},
  {name:"Água Mineral sem gás",category:"Águas",volumeMl:500,sku:"AGUA500",image:photo("photo-1544145945-f90425340c7e")},
  {name:"Suco de Laranja",category:"Sucos",volumeMl:1000,sku:"SUCLAR1L",image:photo("photo-1621506289937-a8e4df240d0b")},
  {name:"Chá Gelado Pêssego",category:"Não alcoólicos",volumeMl:1500,sku:"CHAP1L5",image:photo("photo-1556679343-c7306c1976bc")},
];

export const catalogMatch=(name:string)=>beverageCatalog.find(item=>name.toLowerCase().includes(item.name.toLowerCase())||item.name.toLowerCase().includes(name.toLowerCase().replace(/\s+\d+\s*(ml|l).*$/i,'')));
