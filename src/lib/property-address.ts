// Persisted identity format: changing these rules requires a reviewed data
// migration. Contractor IDs must never be part of a property's address key.
const TOKEN_ALIASES: Record<string, string> = {
  street: "st", st: "st", avenue: "ave", ave: "ave", road: "rd", rd: "rd",
  boulevard: "blvd", blvd: "blvd", drive: "dr", dr: "dr", lane: "ln", ln: "ln",
  court: "ct", ct: "ct", circle: "cir", cir: "cir", parkway: "pkwy", pkwy: "pkwy",
  place: "pl", pl: "pl", terrace: "ter", ter: "ter", highway: "hwy", hwy: "hwy",
  north: "n", south: "s", east: "e", west: "w", apartment: "unit", apt: "unit", suite: "unit",
};

export function normalizePropertyAddress(address: string, zipCode: string): string {
  const street = address.normalize("NFKC").toLowerCase().replace(/#/g, " unit ")
    .replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean)
    .map((token) => TOKEN_ALIASES[token] || token).join(" ");
  return `${street}|${zipCode.trim().slice(0, 5)}`;
}
