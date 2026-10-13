import * as Location from 'expo-location';

export interface ResolvedAddress {
  street: string;
  area: string | null;
}

type Coords = { latitude: number; longitude: number };

const cache = new Map<string, ResolvedAddress | null>();

function join(parts: (string | null | undefined)[], separator: string) {
  const filled = parts.filter((part): part is string => !!part && !!part.trim());
  return filled.length ? filled.join(separator) : null;
}

async function fromDevice({ latitude, longitude }: Coords): Promise<ResolvedAddress | null> {
  const { granted } = await Location.getForegroundPermissionsAsync();
  if (!granted) return null;

  const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
  if (!address) return null;

  const street = join([address.street ?? address.name, address.streetNumber], ', ');
  if (!street) return null;

  return { street, area: join([address.district, join([address.city ?? address.subregion, address.region], '/')], ' — ') };
}

async function fromOpenStreetMap({ latitude, longitude }: Coords): Promise<ResolvedAddress | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=pt-BR&lat=${latitude}&lon=${longitude}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'Fiscalize/1.0 (projeto academico)' } });
  if (!response.ok) return null;

  const { address } = await response.json();
  if (!address) return null;

  const street = join([address.road ?? address.pedestrian ?? address.footway, address.house_number], ', ');
  if (!street) return null;

  return {
    street,
    area: join([address.suburb ?? address.neighbourhood, join([address.city ?? address.town ?? address.village, address.state], '/')], ' — '),
  };
}

export const geocodingService = {
  async reverse(coords: Coords): Promise<ResolvedAddress | null> {
    const key = `${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)}`;
    if (cache.has(key)) return cache.get(key)!;

    let result: ResolvedAddress | null = null;
    try {
      result = await fromDevice(coords);
    } catch {}
    if (!result) {
      try {
        result = await fromOpenStreetMap(coords);
      } catch {}
    }

    cache.set(key, result);
    return result;
  },
};
