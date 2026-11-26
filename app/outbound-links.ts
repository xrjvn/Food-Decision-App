export function reportPriceUrl(restaurant: string) {
  const placeholder = "https://docs.google.com/forms/d/e/REPLACE_WITH_FORM_ID/viewform";
  const configured = process.env.NEXT_PUBLIC_REPORT_URL || placeholder;
  let url: URL;
  try {
    url = new URL(configured);
    if (url.protocol !== "https:") url = new URL(placeholder);
  } catch {
    url = new URL(placeholder);
  }
  const field = process.env.NEXT_PUBLIC_REPORT_RESTAURANT_FIELD;
  url.searchParams.set(field || "restaurant", restaurant);
  if (field) url.searchParams.set("usp", "pp_url");
  return url.toString();
}

export function directionsUrl(restaurant: string, address: string) {
  const params = new URLSearchParams({
    api: "1",
    destination: [restaurant, address, "Waterloo Ontario"].join(", "),
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
