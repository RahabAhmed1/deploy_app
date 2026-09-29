export const formatCurrency = (value: number, withCode = false, fractionDigits: number = 0) => {
  // Format as Pakistani Rupees. Example: Rs 123,456
  const formatted = new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
    .format(value)
    // Some environments include "PKR" prefix; normalize to Rs
    .replace(/^PKR\s?/i, "Rs ")
    .replace(/₨/g, "Rs ");

  if (withCode) return formatted.replace(/^Rs /, "PKR ");
  return formatted;
};
