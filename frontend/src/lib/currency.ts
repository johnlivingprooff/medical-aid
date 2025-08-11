const formatter = new Intl.NumberFormat('en-MW', { style: 'currency', currency: 'MWK', maximumFractionDigits: 0 })

export function formatCurrency(amount: number) {
  if (amount == null || isNaN(amount as any)) return 'MWK 0'
  return formatter.format(amount)
}
