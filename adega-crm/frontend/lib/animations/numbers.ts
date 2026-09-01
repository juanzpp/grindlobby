export type NumberPresentation = 'currency' | 'integer' | 'decimal';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatAnimatedNumber(value: number, presentation: NumberPresentation) {
  if (presentation === 'currency') return currency.format(value);
  if (presentation === 'decimal') return decimal.format(value);
  return integer.format(Math.round(value));
}
