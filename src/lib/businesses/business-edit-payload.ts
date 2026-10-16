export type BusinessMode = 'product' | 'service' | 'both';

export interface BusinessEditValues {
  name: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  category: string;
  mode: BusinessMode;
  hours: string;
  location: string;
  state: string;
  lga: string;
  ward: string;
  lat: number | null;
  lng: number | null;
}

export function buildBusinessEditPayload(values: BusinessEditValues) {
  const hasCoordinates = values.lat !== null && values.lng !== null;

  return {
    name: values.name.trim(),
    description: values.description.trim(),
    phone: values.phone.trim(),
    email: values.email.trim() || null,
    website: values.website.trim(),
    category: values.category,
    mode: values.mode,
    hours: values.hours.trim(),
    location: values.location.trim() || 'Location not specified',
    state: values.state || null,
    lga: values.lga || null,
    ward: values.ward || null,
    lat: hasCoordinates ? values.lat : null,
    lng: hasCoordinates ? values.lng : null,
    location_geom: hasCoordinates ? `POINT(${values.lng} ${values.lat})` : null,
  };
}
