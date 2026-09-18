// Some sets are not labelled as packs in their names. This model's photograph
// contains both a base-layer shirt and trousers.
const setModels = new Set(["127382"]);

export function isMultiItemProduct(product) {
  return (
    setModels.has(product.id?.slice(0, 6)) ||
    /\b(?:[2-9]|\d{2,})\s*[-–]?\s*(?:pack|pakkaus|kpl|paria|pairs?)\b|setti\b|\bset\b/i.test(
      product.name || "",
    )
  );
}

export function singleItemCatalog(products) {
  const included = products.filter((product) => !isMultiItemProduct(product));
  const ids = new Set(included.map((product) => product.id));
  return included.map((product) => ({
    ...product,
    variants: (product.variants || []).filter((variant) => ids.has(variant.id)),
  }));
}
