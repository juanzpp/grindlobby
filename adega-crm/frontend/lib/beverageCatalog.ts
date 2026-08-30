export type BeverageCatalogItem={name:string;category:string;volumeMl:number;sku:string;image:string;barcode?:string};

export const productCutouts={whisky:'/assets/products/cutouts/whisky.png',spirit:'/assets/products/cutouts/clear-spirit.png',beer:'/assets/products/cutouts/beer.png',wine:'/assets/products/cutouts/wine.png',sparkling:'/assets/products/cutouts/sparkling.png',can:'/assets/products/cutouts/can.png',soda:'/assets/products/cutouts/soda.png',water:'/assets/products/cutouts/water.png'} as const;

export function productCutoutFor(name:string,category=''){
  const value=`${name} ${category}`.toLowerCase();
  if(/whisky|whiskey|jack|chivas|jameson|ballantine/.test(value))return productCutouts.whisky;
  if(/espumante|champagne|prosecco/.test(value))return productCutouts.sparkling;
  if(/vinho|cabernet|chardonnay/.test(value))return productCutouts.wine;
  if(/cerveja|long neck|heineken|budweiser|corona|stella/.test(value))return productCutouts.beer;
  if(/energ|red bull|monster|t[oô]nica|lata|350\s*ml|473\s*ml|250\s*ml/.test(value))return productCutouts.can;
  if(/refriger|coca|guaran[aá]|chá|suco/.test(value))return productCutouts.soda;
  if(/[aá]gua|mineral/.test(value))return productCutouts.water;
  return productCutouts.spirit;
}

const item=(name:string,category:string,volumeMl:number,sku:string,barcode?:string):BeverageCatalogItem=>({name,category,volumeMl,sku,barcode,image:productCutoutFor(name,category)});

export const beverageCatalog:BeverageCatalogItem[]=[
  item('Johnnie Walker Red Label','Whisky',1000,'JWRED1L','5000267014203'), item("Jack Daniel's Old No. 7",'Whisky',1000,'JD1L'), item('Chivas Regal 12 anos','Whisky',1000,'CHIVAS1L'), item('Absolut Original','Vodka',750,'ABS750'), item('Smirnoff Nº 21','Vodka',998,'SMI998','7893218000470'), item('Tanqueray London Dry','Gin',750,'TANQ750'), item('Bombay Sapphire','Gin',750,'BOMB750'), item('Campari','Destilados',750,'CAMP750'),
  item('Heineken Long Neck','Cervejas',330,'HEI330','7896045503412'), item('Budweiser Long Neck','Cervejas',330,'BUD330'), item('Corona Extra','Cervejas',330,'COR330'), item('Skol Pilsen','Cervejas',350,'SK350'), item('Vinho Tinto Cabernet Sauvignon','Vinhos',750,'VINHCAB750'), item('Vinho Branco Chardonnay','Vinhos',750,'VINHCHA750'), item('Espumante Brut','Espumantes',750,'ESPBRUT750'), item('Red Bull','Energéticos',250,'RB250'), item('Coca-Cola','Refrigerantes',2000,'COCA2L'), item('Água Tônica','Não alcoólicos',350,'TON350'), item('Jameson Irish Whiskey','Whisky',750,'JAM750'), item("Ballantine's Finest",'Whisky',1000,'BALL1L'),
  item('José Cuervo Especial','Tequila',750,'CUERVO750'), item('Bacardi Carta Blanca','Rum',980,'BAC980'), item('Cachaça 51','Cachaças',965,'C51965'), item('Jägermeister','Licores',700,'JAGER700'), item('Baileys Original','Licores',750,'BAIL750'), item('Stella Artois Long Neck','Cervejas',330,'STELLA330'), item('Brahma Duplo Malte','Cervejas',350,'BRAH350'), item('Monster Energy','Energéticos',473,'MON473'), item('Guaraná Antarctica','Refrigerantes',2000,'GUA2L'), item('Água Mineral sem gás','Águas',500,'AGUA500'), item('Suco de Laranja','Sucos',1000,'SUCLAR1L'), item('Chá Gelado Pêssego','Não alcoólicos',1500,'CHAP1L5'),
];

export const catalogMatch=(name:string)=>beverageCatalog.find(item=>name.toLowerCase().includes(item.name.toLowerCase())||item.name.toLowerCase().includes(name.toLowerCase().replace(/\s+\d+\s*(ml|l).*$/i,'')));
