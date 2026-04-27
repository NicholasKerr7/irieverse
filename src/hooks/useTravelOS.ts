import { useCallback, useEffect, useMemo, useState } from "react";
import type { ViewStateChangeEvent } from "react-map-gl";
import { DESTINATIONS, EXPERIENCES } from "../data/content";
import { fetchBookingOptions } from "../services/bookings";
import {
  type TripPayload,
  fetchTripState,
  hasCollaborationBackend,
  saveTripState,
  serializeTripState,
} from "../services/collab";
import { fetchFlightOptions } from "../services/flights";
import type {
  BookingOption,
  Destination,
  ExperienceType,
  FlightOption,
  ItineraryPlan,
  LiveEvent,
  OriginAirport,
  QuickFact,
  Vibe,
} from "../types/travel";

const EARTH_RADIUS_KM = 6371;
const AVERAGE_JET_SPEED_KMH = 850;
const STORAGE_KEY_ORIGIN_AIRPORT = "irieverse_origin_airport";
const STORAGE_KEY_SAVED_PLACES = "irieverse_saved_places";
const STORAGE_KEY_SAVED_EXPERIENCES = "irieverse_saved_experiences";
const STORAGE_KEY_THEME = "irieverse_theme";

const AIRPORT_TIMEZONES: Record<string, string> = {
  JFK: "America/New_York",
  MIA: "America/New_York",
  YYZ: "America/Toronto",
  LAX: "America/Los_Angeles",
  SCL: "America/Santiago",
  MBJ: "America/Jamaica",
  KIN: "America/Jamaica",
  NEG: "America/Jamaica",
  OCJ: "America/Jamaica",
};

export const ORIGIN_AIRPORTS: OriginAirport[] = [
  { id: "jfk", name: "New York, USA (JFK)", code: "JFK", shortLabel: "NYC", latitude: 40.6413, longitude: -73.7781 },
  { id: "mia", name: "Miami, USA (MIA)", code: "MIA", shortLabel: "Miami", latitude: 25.7959, longitude: -80.287 },
  { id: "yyz", name: "Toronto, CA (YYZ)", code: "YYZ", shortLabel: "Toronto", latitude: 43.6777, longitude: -79.6248 },
  { id: "lax", name: "Los Angeles, USA (LAX)", code: "LAX", shortLabel: "L.A.", latitude: 33.9416, longitude: -118.4085 },
  { id: "scl", name: "Santiago, CL (SCL)", code: "SCL", shortLabel: "Santiago", latitude: -33.4489, longitude: -70.7858 },
];

const DEFAULT_ORIGIN_AIRPORT_ID = ORIGIN_AIRPORTS[0].id;

const BUDGET_PROFILES: Record<
  string,
  {
    lodging: number;
    dining: number;
    experiences: number;
    transport: number;
  }
> = {
  chill: { lodging: 210, dining: 75, experiences: 95, transport: 60 },
  nightlife: { lodging: 240, dining: 95, experiences: 130, transport: 65 },
  adventure: { lodging: 185, dining: 70, experiences: 110, transport: 70 },
  culture: { lodging: 195, dining: 65, experiences: 85, transport: 55 },
  nature: { lodging: 175, dining: 60, experiences: 90, transport: 60 },
  authentic: { lodging: 160, dining: 55, experiences: 80, transport: 50 },
  family: { lodging: 220, dining: 85, experiences: 100, transport: 65 },
  romantic: { lodging: 260, dining: 110, experiences: 120, transport: 60 },
  mixed: { lodging: 200, dining: 70, experiences: 95, transport: 60 },
};

export type ViewMode = "places" | "experiences";
export type ThemeMode = "dark" | "light";

export function useTravelOS() {
  const [viewMode, setViewMode] = useState<ViewMode>("places");
  const [vibe, setVibe] = useState<Vibe>("all");
  const [experienceType, setExperienceType] = useState<ExperienceType>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("trending");
  const [savedPlaces, setSavedPlaces] = useState<Set<string>>(new Set());
  const [savedExperiences, setSavedExperiences] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [plannerBaseId, setPlannerBaseId] = useState("mobay");
  const [plannerDays, setPlannerDays] = useState(5);
  const [plannerVibe, setPlannerVibe] = useState<Vibe>("mixed");
  const [plannerBudget, setPlannerBudget] = useState(150);
  const [plannerStartDate, setPlannerStartDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [originAirportId, setOriginAirportId] = useState(DEFAULT_ORIGIN_AIRPORT_ID);
  const [hasUserPreferredOrigin, setHasUserPreferredOrigin] = useState(false);
  const [liveFacts, setLiveFacts] = useState<QuickFact[] | null>(null);
  const [isFetchingFacts, setIsFetchingFacts] = useState(false);
  const [flightOptions, setFlightOptions] = useState<FlightOption[]>([]);
  const [isFetchingFlights, setIsFetchingFlights] = useState(false);
  const [flightsError, setFlightsError] = useState<string | null>(null);
  const [mapViewState, setMapViewState] = useState({
    latitude: 18.1096,
    longitude: -77.2975,
    zoom: 8.2,
  });
  const [tripId, setTripId] = useState<string | null>(null);
  const [tripShareUrl, setTripShareUrl] = useState("");
  const [isSyncingTrip, setIsSyncingTrip] = useState(false);
  const [tripStatusMessage, setTripStatusMessage] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [bookingOptions, setBookingOptions] = useState<BookingOption[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const collaborationReady = hasCollaborationBackend();
  const destination = useMemo(
    () => DESTINATIONS.find((item) => item.id === plannerBaseId) ?? DESTINATIONS[0],
    [plannerBaseId]
  );
  const originAirport = useMemo(
    () => ORIGIN_AIRPORTS.find((airport) => airport.id === originAirportId) ?? ORIGIN_AIRPORTS[0],
    [originAirportId]
  );

  useEffect(() => {
    const savedDestinations = localStorage.getItem(STORAGE_KEY_SAVED_PLACES);
    const savedExperiencesStored = localStorage.getItem(STORAGE_KEY_SAVED_EXPERIENCES);
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) as ThemeMode | null;

    if (savedDestinations) {
      setSavedPlaces(new Set(JSON.parse(savedDestinations)));
    }
    if (savedExperiencesStored) {
      setSavedExperiences(new Set(JSON.parse(savedExperiencesStored)));
    }
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SAVED_PLACES, JSON.stringify(Array.from(savedPlaces)));
  }, [savedPlaces]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SAVED_EXPERIENCES, JSON.stringify(Array.from(savedExperiences)));
  }, [savedExperiences]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  }, [theme]);

  useEffect(() => {
    const storedOrigin = localStorage.getItem(STORAGE_KEY_ORIGIN_AIRPORT);
    if (storedOrigin && ORIGIN_AIRPORTS.some((airport) => airport.id === storedOrigin)) {
      setOriginAirportId(storedOrigin);
      setHasUserPreferredOrigin(true);
    }
  }, []);

  useEffect(() => {
    if (hasUserPreferredOrigin) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const nearest = findNearestAirport(position.coords.latitude, position.coords.longitude);
        setOriginAirportId(nearest.id);
        localStorage.setItem(STORAGE_KEY_ORIGIN_AIRPORT, nearest.id);
        setHasUserPreferredOrigin(true);
      },
      () => {
        // Keep the default origin when permission is denied or unavailable.
      },
      {
        enableHighAccuracy: false,
        maximumAge: 600000,
        timeout: 10000,
      }
    );

    return () => {
      cancelled = true;
    };
  }, [hasUserPreferredOrigin]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadFacts() {
      setIsFetchingFacts(true);
      try {
        const params = new URLSearchParams({
          latitude: destination.latitude.toString(),
          longitude: destination.longitude.toString(),
          current_weather: "true",
          timezone: "auto",
        });

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Weather fetch failed");
        }
        const data = await response.json();
        if (cancelled) return;

        const weather = data.current_weather;
        const weatherFact: QuickFact | null = weather
          ? {
              label: "Weather",
              value: `${Math.round(weather.temperature)}°C · ${Math.round(
                weather.windspeed
              )} km/h winds`,
            }
          : null;

        const flightFact: QuickFact = {
          label: `From ${originAirport.shortLabel ?? originAirport.code}`,
          value: estimateFlightDuration(originAirport, destination),
        };

        const timezone: string | undefined = data.timezone;
        let localTimeFact: QuickFact | null = null;
        if (timezone) {
          const timeFormatter = new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "numeric",
            hour12: true,
            timeZone: timezone,
          });
          localTimeFact = {
            label: "Local time",
            value: timeFormatter.format(new Date()),
          };
        }

        const facts: QuickFact[] = [
          ...(weatherFact ? [weatherFact] : []),
          flightFact,
          ...(localTimeFact ? [localTimeFact] : []),
        ];

        setLiveFacts(facts);
      } catch (error) {
        if (!cancelled) {
          setLiveFacts(null);
        }
      } finally {
        if (!cancelled) {
          setIsFetchingFacts(false);
        }
      }
    }

    loadFacts();

    async function loadFlights() {
      setIsFetchingFlights(true);
      setFlightsError(null);
      try {
        const flights = await fetchFlightOptions(originAirport.code, destination.airportCode);
        if (!cancelled) {
          setFlightOptions(flights);
        }
      } catch (error) {
        if (!cancelled) {
          setFlightsError("Flights unavailable right now");
          setFlightOptions([]);
        }
      } finally {
        if (!cancelled) {
          setIsFetchingFlights(false);
        }
      }
    }

    loadFlights();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [destination, originAirport]);

  const loadEvents = useCallback(async () => {
    const selectedRegion = destination.region.toLowerCase();

    setIsLoadingEvents(true);
    setEventsError(null);
    try {
      const response = await fetch("/data/events.json");
      if (!response.ok) {
        throw new Error("Events fetch failed");
      }
      const events: LiveEvent[] = await response.json();
      const filteredEvents = events
        .filter((event) => event.region?.toLowerCase() === selectedRegion)
        .sort(
          (first, second) =>
            new Date(first.startDate).getTime() - new Date(second.startDate).getTime()
        );
      setLiveEvents(filteredEvents);
    } catch (error) {
      console.error(error);
      setEventsError("Live events unavailable right now.");
      setLiveEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [destination.region]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const loadBookings = useCallback(
    async (destinationAirport: string, originAirportCode: string) => {
      setIsLoadingBookings(true);
      setBookingError(null);
      try {
        const options = await fetchBookingOptions(destinationAirport, originAirportCode);
        setBookingOptions(options);
      } catch (error) {
        console.error(error);
        setBookingError("Booking partners unavailable right now.");
        setBookingOptions([]);
      } finally {
        setIsLoadingBookings(false);
      }
    },
    []
  );

  const refreshBookings = useCallback(() => {
    loadBookings(destination.airportCode, originAirport.code);
  }, [destination.airportCode, loadBookings, originAirport.code]);

  useEffect(() => {
    refreshBookings();
  }, [refreshBookings]);

  const filteredDestinations = useMemo(() => {
    let items = [...DESTINATIONS];

    if (vibe !== "all") {
      items = items.filter((item) => item.vibes.includes(vibe));
    }

    if (search) {
      const query = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.region.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.headline.toLowerCase().includes(query)
      );
    }

    if (sort === "rating") {
      items.sort((a, b) => b.rating - a.rating);
    } else if (sort === "priceLow") {
      items.sort((a, b) => a.priceLevel - b.priceLevel);
    }

    return items;
  }, [search, sort, vibe]);

  const filteredExperiences = useMemo(() => {
    let items = [...EXPERIENCES];

    if (experienceType !== "all") {
      items = items.filter((experience) => experience.type === experienceType);
    }
    if (vibe !== "all") {
      items = items.filter((experience) => experience.vibes.includes(vibe));
    }
    if (search) {
      const query = search.toLowerCase();
      items = items.filter(
        (experience) =>
          experience.title.toLowerCase().includes(query) ||
          experience.description.toLowerCase().includes(query) ||
          experience.region.toLowerCase().includes(query)
      );
    }

    return items;
  }, [experienceType, search, vibe]);

  const itinerary: ItineraryPlan = useMemo(() => {
    const placePool = DESTINATIONS.slice()
      .sort((a, b) => b.rating - a.rating)
      .filter(
        (item) =>
          plannerVibe === "mixed" ||
          item.vibes.includes(plannerVibe) ||
          item.id === destination.id
      );

    const expPool = EXPERIENCES.slice().sort((a, b) => b.rating - a.rating);

    const daysPlan = Array.from({ length: plannerDays }, (_, index) => {
      const tripDestination = placePool[index % placePool.length];
      const destinationVibe = plannerVibe === "mixed" ? tripDestination.vibes[0] ?? "chill" : plannerVibe;
      const highlight =
        tripDestination.highlights[index % tripDestination.highlights.length] ??
        tripDestination.highlights[0];
      const matchedExperiences = expPool.filter(
        (experience) =>
          experience.linkedDestinationId === tripDestination.id ||
          experience.region === tripDestination.region ||
          experience.vibes.includes(destinationVibe)
      );
      const experience = matchedExperiences[0] ?? expPool[index % expPool.length];

      return {
        day: index + 1,
        destName: tripDestination.name,
        destRegion: tripDestination.region,
        vibe: destinationVibe,
        highlight,
        suggestedBudget: plannerBudget,
        isBase: tripDestination.id === destination.id,
        experience,
      };
    });

    return {
      base: destination,
      days: plannerDays,
      plannerVibe,
      budgetPerDay: plannerBudget,
      daysPlan,
    };
  }, [destination, plannerBudget, plannerDays, plannerVibe]);

  const defaultFlightFact: QuickFact = {
    label: `From ${originAirport.shortLabel ?? originAirport.code}`,
    value: estimateFlightDuration(originAirport, destination),
  };
  const heroFacts =
    (!isFetchingFacts && liveFacts?.length ? liveFacts : null) ??
    destination.quickFacts ?? [
      { label: "Best season", value: "Dec – Apr" },
      defaultFlightFact,
      { label: "Current vibes", value: "28°C · trade winds" },
    ];

  const budgetProfile = BUDGET_PROFILES[plannerVibe] ?? BUDGET_PROFILES.mixed;
  const perDayBudget = {
    lodging: budgetProfile.lodging,
    dining: budgetProfile.dining,
    experiences: Math.max(budgetProfile.experiences, plannerBudget * 0.35),
  };
  const transportBudget = Math.max(
    budgetProfile.transport * Math.ceil(plannerDays / 3),
    50
  );

  const applyTripPayload = useCallback((payload: TripPayload) => {
    setPlannerBaseId(payload.plannerBaseId ?? "mobay");
    setPlannerDays(payload.plannerDays ?? 5);
    setPlannerVibe((payload.plannerVibe as Vibe) ?? "mixed");
    setPlannerBudget(payload.plannerBudget ?? 150);
    if (payload.plannerStartDate) {
      setPlannerStartDate(payload.plannerStartDate);
    }
    if (payload.originAirportId && ORIGIN_AIRPORTS.some((airport) => airport.id === payload.originAirportId)) {
      setOriginAirportId(payload.originAirportId);
    }
    setSavedPlaces(new Set(payload.savedPlaces ?? []));
    setSavedExperiences(new Set(payload.savedExperiences ?? []));
  }, []);

  useEffect(() => {
    if (!collaborationReady || typeof window === "undefined") return;

    const sharedTripId = new URLSearchParams(window.location.search).get("trip");
    if (!sharedTripId) return;

    let cancelled = false;
    setIsSyncingTrip(true);
    fetchTripState(sharedTripId)
      .then((payload) => {
        if (cancelled) return;
        applyTripPayload(payload);
        setTripId(sharedTripId);
        setTripShareUrl(buildShareUrl(sharedTripId));
        setTripStatusMessage("Shared trip loaded");
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setTripStatusMessage("Unable to load shared trip");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSyncingTrip(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyTripPayload, collaborationReady]);

  const handleOriginAirportChange = (airportId: string) => {
    setOriginAirportId(airportId);
    setHasUserPreferredOrigin(true);
    localStorage.setItem(STORAGE_KEY_ORIGIN_AIRPORT, airportId);
  };

  const toggleSavedPlace = (id: string) => {
    setSavedPlaces((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSavedExperience = (id: string) => {
    setSavedExperiences((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const savePlace = (id: string) => {
    setSavedPlaces((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const saveExperience = (id: string) => {
    setSavedExperiences((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleMapMove = (event: ViewStateChangeEvent) => {
    setMapViewState({
      latitude: event.viewState.latitude,
      longitude: event.viewState.longitude,
      zoom: event.viewState.zoom,
    });
  };

  const handleExportItinerary = () => {
    if (!plannerStartDate) {
      alert("Please choose a trip start date before exporting.");
      return;
    }
    if (!itinerary.daysPlan.length) {
      alert("Itinerary is empty. Adjust planner settings and try again.");
      return;
    }
    try {
      const icsContent = buildItineraryICS(itinerary, plannerStartDate, originAirport);
      const blob = new Blob([icsContent], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `IrieVerse-${destination.name.replace(/\s+/g, "-")}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Unable to generate itinerary export right now.");
    }
  };

  const handleShareTrip = async () => {
    if (!collaborationReady) {
      setTripStatusMessage("Enable Supabase to share trips.");
      return;
    }
    setIsSyncingTrip(true);
    setTripStatusMessage(null);
    try {
      const payload = serializeTripState({
        plannerBaseId,
        plannerDays,
        plannerVibe,
        plannerBudget,
        plannerStartDate,
        originAirportId,
        savedPlaces,
        savedExperiences,
      });
      const id = await saveTripState(tripId, payload);
      setTripId(id);
      const shareUrl = buildShareUrl(id);
      setTripShareUrl(shareUrl);
      updateUrlWithTrip(shareUrl);
      setTripStatusMessage("Share link updated");
    } catch (error) {
      console.error(error);
      setTripStatusMessage("Unable to share trip right now");
    } finally {
      setIsSyncingTrip(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!tripShareUrl) return;
    try {
      await navigator.clipboard.writeText(tripShareUrl);
      setTripStatusMessage("Link copied!");
    } catch (error) {
      console.error(error);
      setTripStatusMessage("Copy unavailable");
    }
  };

  useEffect(() => {
    if (!tripId || !collaborationReady) return;
    const payload = serializeTripState({
      plannerBaseId,
      plannerDays,
      plannerVibe,
      plannerBudget,
      plannerStartDate,
      originAirportId,
      savedPlaces,
      savedExperiences,
    });

    const handler = setTimeout(() => {
      setIsSyncingTrip(true);
      saveTripState(tripId, payload)
        .then(() => setTripStatusMessage("Trip synced"))
        .catch((error) => {
          console.error(error);
          setTripStatusMessage("Sync failed");
        })
        .finally(() => setIsSyncingTrip(false));
    }, 1500);

    return () => clearTimeout(handler);
  }, [
    tripId,
    collaborationReady,
    plannerBaseId,
    plannerDays,
    plannerVibe,
    plannerBudget,
    plannerStartDate,
    originAirportId,
    savedPlaces,
    savedExperiences,
  ]);

  return {
    viewMode,
    setViewMode,
    vibe,
    setVibe,
    experienceType,
    setExperienceType,
    search,
    setSearch,
    sort,
    setSort,
    savedPlaces,
    savedExperiences,
    theme,
    toggleTheme: () => setTheme((prev) => (prev === "dark" ? "light" : "dark")),
    plannerBaseId,
    setPlannerBaseId,
    plannerDays,
    setPlannerDays,
    plannerVibe,
    setPlannerVibe,
    plannerBudget,
    setPlannerBudget,
    plannerStartDate,
    setPlannerStartDate,
    originAirportId,
    handleOriginAirportChange,
    originAirports: ORIGIN_AIRPORTS,
    liveFacts,
    isFetchingFacts,
    flightOptions,
    isFetchingFlights,
    flightsError,
    mapViewState,
    handleMapMove,
    tripId,
    tripShareUrl,
    isSyncingTrip,
    tripStatusMessage,
    collaborationReady,
    liveEvents,
    isLoadingEvents,
    eventsError,
    loadEvents,
    bookingOptions,
    isLoadingBookings,
    bookingError,
    refreshBookings,
    filteredDestinations,
    filteredExperiences,
    itinerary,
    heroVideoUrl: "/media/hero.mp4",
    destination,
    originAirport,
    heroFacts,
    perDayBudget,
    transportBudget,
    toggleSavedPlace,
    toggleSavedExperience,
    savePlace,
    saveExperience,
    handleExportItinerary,
    handleShareTrip,
    handleCopyShareLink,
  };
}

export type TravelOS = ReturnType<typeof useTravelOS>;

function estimateFlightDuration(origin: OriginAirport, destination: Pick<Destination, "latitude" | "longitude">): string {
  const distanceKm = haversineDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
  const hours = distanceKm / AVERAGE_JET_SPEED_KMH;
  return formatFlightDuration(hours);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function formatFlightDuration(hours: number): string {
  if (!isFinite(hours) || hours <= 0) {
    return "~3h 30m flight";
  }
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${wholeHours}h ${minutes.toString().padStart(2, "0")}m flight`;
}

function findNearestAirport(latitude: number, longitude: number): OriginAirport {
  let closest = ORIGIN_AIRPORTS[0];
  let minDistance = Number.POSITIVE_INFINITY;

  ORIGIN_AIRPORTS.forEach((airport) => {
    const distance = haversineDistance(latitude, longitude, airport.latitude, airport.longitude);
    if (distance < minDistance) {
      closest = airport;
      minDistance = distance;
    }
  });

  return closest;
}

export function formatLocalTime(dateString: string, airportCode: string): string {
  const fallback = new Date(dateString).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (!dateString) return fallback;
  const targetTimeZone = AIRPORT_TIMEZONES[airportCode] ?? "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: targetTimeZone,
    }).format(new Date(dateString));
  } catch {
    return fallback;
  }
}

function buildItineraryICS(itinerary: ItineraryPlan, startDateISO: string, originAirport: OriginAirport): string {
  const startDate = new Date(`${startDateISO}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Invalid start date");
  }

  const dtStamp = formatICSTimestamp(new Date());
  const events = itinerary.daysPlan.map((day) => {
    const eventDate = new Date(startDate);
    eventDate.setDate(startDate.getDate() + (day.day - 1));
    const dtStart = formatICSDate(eventDate);
    const uid = `${day.day}-${itinerary.base.id}-${originAirport.code}@irieverse`;

    const description = [
      day.highlight,
      day.experience ? `Experience: ${day.experience.title}` : null,
      day.experience ? day.experience.description : null,
    ]
      .filter(Boolean)
      .join("\\n");

    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `SUMMARY:Day ${day.day} · ${day.destName} (${day.vibe})`,
      `LOCATION:${day.destRegion}, Jamaica`,
      `DESCRIPTION:${description || "IrieVerse itinerary day"}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IrieVerse Travel OS//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function formatICSDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatICSTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildShareUrl(sharedTripId: string): string {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?trip=${encodeURIComponent(sharedTripId)}`;
}

function updateUrlWithTrip(shareUrl: string) {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, "", shareUrl);
}
