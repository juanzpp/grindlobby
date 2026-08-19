export const AGE_BAND_OPTIONS=[
  {value:"under_13",label:"Menos de 13",detail:"Experiência infantil; lobby, voz e tela exigem responsável."},
  {value:"13_15",label:"13 a 15",detail:"Experiência jovem; lobby, voz e tela exigem responsável."},
  {value:"16_17",label:"16 ou 17",detail:"Experiência adolescente; compras permanecem restritas."},
  {value:"18_plus",label:"18 ou mais",detail:"Compras exigem age assurance concluída por provedor confiável."},
] as const;

export type AgeBand=(typeof AGE_BAND_OPTIONS)[number]["value"];

export const AGE_BANDS=AGE_BAND_OPTIONS.map(option=>option.value) as [AgeBand,...AgeBand[]];

export const AGE_BAND_LABELS=Object.fromEntries(
  AGE_BAND_OPTIONS.map(option=>[option.value,option.label]),
) as Record<AgeBand,string>;
