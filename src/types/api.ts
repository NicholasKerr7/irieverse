import type {
  BookingOption,
  FlightOption,
  ImportedIdeaSourcePlatform,
} from "./travel";

type QueryValue = string | string[] | undefined;
export type QueryRecord = Record<string, QueryValue>;

export interface ApiRequest {
  method?: string;
  query?: QueryRecord;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}

export interface ApiResponse {
  setHeader(name: string, value: string): unknown;
  status(statusCode: number): ApiResponse;
  json(payload: unknown): unknown;
  end(payload?: string): unknown;
}

export type ApiHandler = (req: ApiRequest, res: ApiResponse) => void | Promise<void>;

export type FlightApiMeta = {
  source: "aviationstack" | "fallback";
  reason?: string;
  providerConfigured: boolean;
  origin: string;
  destination: string;
  cached?: boolean;
  cacheTtlSeconds?: number;
  retryAfterSeconds?: number;
};

export type FlightApiResponse = {
  data: FlightOption[];
  meta: FlightApiMeta;
};

export type BookingApiMeta = {
  source: "amadeus" | "fallback";
  reason?: string;
  checkInDate?: string;
  checkOutDate?: string;
  adults?: number;
};

export type BookingApiResponse = {
  data: BookingOption[];
  meta: BookingApiMeta;
};

export type PlaceDetails = {
  id: string;
  name: string;
  address: string;
  shortAddress: string;
  latitude?: number;
  longitude?: number;
  mapsUrl: string;
  websiteUrl: string;
  phone: string;
  internationalPhone: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel: string;
  openNow?: boolean;
  weekdayDescriptions: string[];
  businessStatus: string;
  primaryType: string;
  types: string[];
  source: "google-places";
};

export type PlaceDetailsApiData = Partial<PlaceDetails> & {
  source: "google-places";
};

export type PlaceDetailsApiResponse = {
  data: PlaceDetailsApiData | null;
  meta: {
    source: "google-places" | "curated";
    providerConfigured: boolean;
    cached?: boolean;
    reason?: string;
  };
};

export type ImportMetadataPlace = {
  name: string;
  address: string;
  shortAddress: string;
  latitude?: number;
  longitude?: number;
  mapsUrl: string;
  websiteUrl: string;
  phone: string;
  rating?: number;
  userRatingCount?: number;
  primaryType: string;
  types: string[];
};

export type ImportMetadata = {
  url: string;
  finalUrl: string;
  sourcePlatform: ImportedIdeaSourcePlatform;
  sourceLabel: string;
  title: string;
  description: string;
  imageUrl: string;
  siteName: string;
  place?: ImportMetadataPlace;
  confidence: "high" | "medium" | "low";
  reason?: string;
  cached?: boolean;
};

export type ImportMetadataApiData = Omit<ImportMetadata, "place"> & {
  place?: Partial<ImportMetadataPlace>;
};

export type ImportMetadataApiResponse = {
  data: ImportMetadataApiData;
};

export type RoadRouteStep = {
  id: string;
  instruction: string;
  distanceKm: number;
  durationMinutes: number;
  roadName: string;
  maneuverType: string;
  modifier: string;
  direction: string;
  exitNumber?: number;
  location?: [number, number];
  ref?: string;
  destinations?: string;
};

export type RoadRoute = {
  coordinates: Array<[number, number]>;
  distanceKm: number;
  durationMinutes: number;
  summary: string;
  steps: RoadRouteStep[];
  source: "osrm";
};

export type RoadRouteApiResponse =
  | {
      data: RoadRoute;
      meta: {
        source: "osrm";
        stepCount: number;
      };
    }
  | {
      data: null;
      meta: {
        source: "fallback";
        reason: "road-route-unavailable";
        message: string;
      };
    };
