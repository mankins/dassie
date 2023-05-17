import type { CurrencySpecification } from "../../types/currency"

export interface AmountProperties {
  value: bigint
  currency: CurrencySpecification
}

export const Amount = ({ value, currency }: AmountProperties) => {
  const negative = value < 0n ? "-" : ""
  const absoluteBalance = negative ? -value : value

  const totalPrecisionDividend = 10n ** BigInt(currency.totalPrecision)
  10n ** BigInt(currency.totalPrecision - currency.precision)

  const integerPart = (absoluteBalance / totalPrecisionDividend).toLocaleString(
    undefined,
    { useGrouping: true }
  )
  const fractionalPart = (absoluteBalance % totalPrecisionDividend)
    .toString()
    .padStart(currency.totalPrecision, "0")
  const emphasizedPart = fractionalPart.slice(0, currency.precision)
  const deemphasizedPart = fractionalPart.slice(currency.precision)

  return (
    <div className="inline-flex items-baseline">
      {negative ? <div>&minus;&#x2009;</div> : null}
      <div>{currency.symbol}&#x2009;</div>
      <div>{integerPart}</div>
      <div>.</div>
      <div>{emphasizedPart}</div>
      <div className="text-muted-foreground">
        {deemphasizedPart.slice(0, 2)}
      </div>
    </div>
  )
}
