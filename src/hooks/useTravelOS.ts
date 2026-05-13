import { useCallback, useEffect, useMemo, useState } from "react";
import type { ViewStateChangeEvent } from "react-map-gl/maplibre";
import { DESTINATIONS, EXPERIENCES } from "../data/content";
import {
  DEFAULT_PLANNING_MODE,
  DEFAULT_PLANNING_TEMPLATE_ID,
  PLANNING_TEMPLATES,
  getDefaultTemplateForMode,
  getPlanningTemplate,
  isPlanningMode,
  isPlanningTemplateId,
} from "../data/plannerTemplates";
import {
  fetchBookingOptions,
  getInitialBookingSourceMeta,
  type BookingSourceMeta,
} from "../services/bookings";
import type { CloudBoardPayload } from "../services/cloudBoards";
import {
  type CollaborationErrorCode,
  type TripPayload,
  fetchTripState,
  getCollaborationErrorCode,
  getCollaborationErrorMessage,
  getStoredTripEditToken,
  hasCollaborationBackend,
  rememberTripEditToken,
  saveTripState,
  serializeTripState,
} from "../services/collab";
import {
  fetchFlightOptions,
  getInitialFlightSourceMeta,
  type FlightSourceMeta,
} from "../services/flights";
import type {
  BookingOption,
  Destination,
  ExperienceType,
  FlightOption,
  ImportedIdea,
  ItineraryPlan,
  DayExperienceOverrides,
  DayNotes,
  LiveEvent,
  ImportedIdeaDayAssignments,
  OriginAirport,
  PlanningMode,
  PlanningTemplateId,
  QuickFact,
  Vibe,
  WeatherPlanDay,
} from "../types/travel";
import { formatDriveTime, formatLocalTimeForAirport } from "../utils/format";
import { getExperienceOptionsForDay } from "../utils/dayExperienceOptions";
import {
  addDaysToISODate,
  arraysEqual,
  buildItineraryPlan,
  buildRouteOrder,
  clampPlannerBudget,
  clampPlannerDays,
  haversineDistance,
  normalizeRouteDestinationIds,
} from "../utils/itinerary";
import {
  isStringArray,
  isStringRecord,
  readJsonFromStorage,
  readStringFromStorage,
  writeJsonToStorage,
  writeStringToStorage,
} from "../utils/storage";
import { logRecoverableWarning } from "../utils/logging";

const AVERAGE_JET_SPEED_KMH = 850;
const STORAGE_KEY_ORIGIN_AIRPORT = "irieverse_origin_airport";
const STORAGE_KEY_SAVED_PLACES = "irieverse_saved_places";
const STORAGE_KEY_SAVED_EXPERIENCES = "irieverse_saved_experiences";
const STORAGE_KEY_IMPORTED_IDEAS = "irieverse_imported_ideas";
const STORAGE_KEY_MANUAL_ROUTE = "irieverse_manual_route";
const STORAGE_KEY_LOCKED_ROUTE = "irieverse_locked_route";
const STORAGE_KEY_DAY_EXPERIENCES = "irieverse_day_experiences";
const STORAGE_KEY_DAY_NOTES = "irieverse_day_notes";
const STORAGE_KEY_IMPORTED_IDEA_DAYS = "irieverse_imported_idea_days";
const STORAGE_KEY_THEME = "irieverse_theme";
const STORAGE_KEY_PLANNING_MODE = "irieverse_planning_mode";
const STORAGE_KEY_PLANNING_TEMPLATE = "irieverse_planning_template";

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
  { id: "mbj", name: "Montego Bay, Jamaica (MBJ)", code: "MBJ", shortLabel: "MoBay", latitude: 18.5037, longitude: -77.9134 },
  { id: "kin", name: "Kingston, Jamaica (KIN)", code: "KIN", shortLabel: "Kingston", latitude: 17.9357, longitude: -76.7875 },
  { id: "ocj", name: "Ocho Rios, Jamaica (OCJ)", code: "OCJ", shortLabel: "Ochi", latitude: 18.4042, longitude: -76.969 },
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
  const [savedPlaces, setSavedPlaces] = useState<Set<string>>(
    () => new Set(readJsonFromStorage(STORAGE_KEY_SAVED_PLACES, [], isStringArray))
  );
  const [savedExperiences, setSavedExperiences] = useState<Set<string>>(
    () => new Set(readJsonFromStorage(STORAGE_KEY_SAVED_EXPERIENCES, [], isStringArray))
  );
  const [importedIdeas, setImportedIdeas] = useState<ImportedIdea[]>(() =>
    readJsonFromStorage(STORAGE_KEY_IMPORTED_IDEAS, [], isImportedIdeaArray)
  );
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [planningMode, setPlanningModeState] = useState<PlanningMode>(() => getInitialPlanningMode());
  const [planningTemplateId, setPlanningTemplateId] = useState<PlanningTemplateId>(() =>
    getInitialPlanningTemplateId()
  );
  const [plannerBaseId, setPlannerBaseId] = useState("mobay");
  const [plannerDays, setPlannerDays] = useState(5);
  const [plannerVibe, setPlannerVibe] = useState<Vibe>("mixed");
  const [plannerBudget, setPlannerBudget] = useState(150);
  const [plannerStartDate, setPlannerStartDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [manualRouteDestinationIds, setManualRouteDestinationIds] = useState<string[]>(() =>
    readJsonFromStorage(STORAGE_KEY_MANUAL_ROUTE, [], isStringArray)
  );
  const [lockedRouteDestinationIds, setLockedRouteDestinationIds] = useState<string[]>(() =>
    readJsonFromStorage(STORAGE_KEY_LOCKED_ROUTE, [], isStringArray)
  );
  const [dayExperienceOverrides, setDayExperienceOverrides] = useState<DayExperienceOverrides>(() =>
    readJsonFromStorage(STORAGE_KEY_DAY_EXPERIENCES, {}, isStringRecord)
  );
  const [dayNotes, setDayNotes] = useState<DayNotes>(() =>
    readJsonFromStorage(STORAGE_KEY_DAY_NOTES, {}, isStringRecord)
  );
  const [importedIdeaDayAssignments, setImportedIdeaDayAssignments] = useState<ImportedIdeaDayAssignments>(() =>
    readJsonFromStorage(STORAGE_KEY_IMPORTED_IDEA_DAYS, {}, isStringRecord)
  );
  const [originAirportId, setOriginAirportId] = useState(() => getInitialOriginAirportId());
  const [hasUserPreferredOrigin, setHasUserPreferredOrigin] = useState(() => Boolean(getStoredOriginAirportId()));
  const [liveFacts, setLiveFacts] = useState<QuickFact[] | null>(null);
  const [weatherPlan, setWeatherPlan] = useState<WeatherPlanDay[]>([]);
  const [isFetchingFacts, setIsFetchingFacts] = useState(false);
  const [flightOptions, setFlightOptions] = useState<FlightOption[]>([]);
  const [flightSourceMeta, setFlightSourceMeta] = useState<FlightSourceMeta>(getInitialFlightSourceMeta);
  const [isFetchingFlights, setIsFetchingFlights] = useState(false);
  const [flightsError, setFlightsError] = useState<string | null>(null);
  const [mapViewState, setMapViewState] = useState({
    latitude: 18.1096,
    longitude: -77.2975,
    zoom: 8.2,
  });
  const [tripId, setTripId] = useState<string | null>(null);
  const [tripEditToken, setTripEditToken] = useState<string | null>(null);
  const [tripShareUrl, setTripShareUrl] = useState("");
  const [isSyncingTrip, setIsSyncingTrip] = useState(false);
  const [tripStatusMessage, setTripStatusMessage] = useState<string | null>(null);
  const [collaborationErrorCode, setCollaborationErrorCode] = useState<CollaborationErrorCode | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [bookingOptions, setBookingOptions] = useState<BookingOption[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSourceMeta, setBookingSourceMeta] = useState<BookingSourceMeta>(getInitialBookingSourceMeta);

  const collaborationReady = hasCollaborationBackend();
  const destination = useMemo(
    () => DESTINATIONS.find((item) => item.id === plannerBaseId) ?? DESTINATIONS[0],
    [plannerBaseId]
  );
  const originAirport = useMemo(
    () => ORIGIN_AIRPORTS.find((airport) => airport.id === originAirportId) ?? ORIGIN_AIRPORTS[0],
    [originAirportId]
  );
  const activePlanningTemplate = useMemo(
    () => getPlanningTemplate(planningTemplateId),
    [planningTemplateId]
  );
  const planningTemplates = PLANNING_TEMPLATES;

  useEffect(() => {
    writeJsonToStorage(STORAGE_KEY_SAVED_PLACES, Array.from(savedPlaces));
  }, [savedPlaces]);

  useEffect(() => {
    writeJsonToStorage(STORAGE_KEY_SAVED_EXPERIENCES, Array.from(savedExperiences));
  }, [savedExperiences]);

  useEffect(() => {
    writeJsonToStorage(STORAGE_KEY_IMPORTED_IDEAS, importedIdeas);
  }, [importedIdeas]);

  useEffect(() => {
    writeStringToStorage(STORAGE_KEY_PLANNING_MODE, planningMode);
  }, [planningMode]);

  useEffect(() => {
    writeStringToStorage(STORAGE_KEY_PLANNING_TEMPLATE, planningTemplateId);
  }, [planningTemplateId]);

  useEffect(() => {
    writeJsonToStorage(STORAGE_KEY_MANUAL_ROUTE, manualRouteDestinationIds);
  }, [manualRouteDestinationIds]);

  useEffect(() => {
    writeJsonToStorage(STORAGE_KEY_LOCKED_ROUTE, lockedRouteDestinationIds);
  }, [lockedRouteDestinationIds]);

  useEffect(() => {
    writeJsonToStorage(STORAGE_KEY_DAY_EXPERIENCES, dayExperienceOverrides);
  }, [dayExperienceOverrides]);

  useEffect(() => {
    writeJsonToStorage(STORAGE_KEY_DAY_NOTES, dayNotes);
  }, [dayNotes]);

  useEffect(() => {
    writeJsonToStorage(STORAGE_KEY_IMPORTED_IDEA_DAYS, importedIdeaDayAssignments);
  }, [importedIdeaDayAssignments]);

  useEffect(() => {
    setManualRouteDestinationIds((prev) => {
      const normalized = normalizeRouteDestinationIds(prev, plannerBaseId, plannerDays);
      return arraysEqual(prev, normalized) ? prev : normalized;
    });
  }, [plannerBaseId, plannerDays]);

  useEffect(() => {
    setLockedRouteDestinationIds((prev) => {
      const routeIds = new Set(normalizeRouteDestinationIds(manualRouteDestinationIds, plannerBaseId, plannerDays));
      const normalized = normalizeRouteDestinationIds(prev, plannerBaseId, plannerDays).filter((id) => routeIds.has(id));
      return arraysEqual(prev, normalized) ? prev : normalized;
    });
  }, [manualRouteDestinationIds, plannerBaseId, plannerDays]);

  useEffect(() => {
    setDayExperienceOverrides((prev) => {
      const next = normalizeDayExperienceOverrides(prev, plannerDays);
      return stringRecordsEqual(prev, next) ? prev : next;
    });
    setDayNotes((prev) => {
      const next = normalizeDayNotes(prev, plannerDays);
      return stringRecordsEqual(prev, next) ? prev : next;
    });
    setImportedIdeaDayAssignments((prev) => {
      const next = normalizeImportedIdeaDayAssignments(prev, plannerDays, importedIdeas);
      return stringRecordsEqual(prev, next) ? prev : next;
    });
  }, [importedIdeas, plannerDays]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]:not([media])')
      ?.setAttribute("content", theme === "dark" ? "#020617" : "#f8fafc");
    writeStringToStorage(STORAGE_KEY_THEME, theme);
  }, [theme]);

  useEffect(() => {
    if (hasUserPreferredOrigin) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const nearest = findNearestAirport(position.coords.latitude, position.coords.longitude);
        setOriginAirportId(nearest.id);
        writeStringToStorage(STORAGE_KEY_ORIGIN_AIRPORT, nearest.id);
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
      setWeatherPlan([]);
      try {
        const params = new URLSearchParams({
          latitude: destination.latitude.toString(),
          longitude: destination.longitude.toString(),
          current_weather: "true",
          daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
          forecast_days: "16",
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
        const weatherPlanDays = parseWeatherPlanDays(data);

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
        setWeatherPlan(weatherPlanDays);
      } catch (error) {
        if (!cancelled) {
          setLiveFacts(null);
          setWeatherPlan([]);
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
        const { options, meta } = await fetchFlightOptions(originAirport.code, destination.airportCode);
        if (!cancelled) {
          setFlightOptions(options);
          setFlightSourceMeta(meta);
        }
      } catch (error) {
        if (!cancelled) {
          setFlightsError("Flights unavailable right now");
          setFlightOptions([]);
          setFlightSourceMeta({
            source: "local",
            reason: "flight-data-unavailable",
            endpointConfigured: true,
            providerConfigured: false,
          });
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
      logRecoverableWarning("Events unavailable; showing an empty regional calendar.", error);
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
    async (destinationAirport: string, originAirportCode: string, checkInDate: string, tripDays: number) => {
      setIsLoadingBookings(true);
      setBookingError(null);
      try {
        const { options, meta } = await fetchBookingOptions(destinationAirport, originAirportCode, {
          checkInDate,
          checkOutDate: addDaysToISODate(checkInDate, tripDays),
          adults: 2,
        });
        setBookingOptions(options);
        setBookingSourceMeta(meta);
      } catch (error) {
        logRecoverableWarning("Booking lookup unavailable; showing curated stays.", error);
        setBookingError("Booking partners unavailable right now.");
        setBookingOptions([]);
        setBookingSourceMeta({
          ...getInitialBookingSourceMeta(),
          source: getInitialBookingSourceMeta().endpointConfigured ? "fallback" : "local",
          reason: "request-failed",
        });
      } finally {
        setIsLoadingBookings(false);
      }
    },
    []
  );

  const refreshBookings = useCallback(() => {
    loadBookings(destination.airportCode, originAirport.code, plannerStartDate, plannerDays);
  }, [destination.airportCode, loadBookings, originAirport.code, plannerDays, plannerStartDate]);

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
    return buildItineraryPlan({
      destination,
      manualRouteDestinationIds,
      savedPlaces,
      savedExperiences,
      importedIdeas,
      plannerVibe,
      plannerBudget,
      plannerDays,
      plannerStartDate,
      weatherPlan,
      dayExperienceOverrides,
    });
  }, [
    dayExperienceOverrides,
    destination,
    importedIdeas,
    manualRouteDestinationIds,
    plannerBudget,
    plannerDays,
    plannerStartDate,
    plannerVibe,
    savedPlaces,
    savedExperiences,
    weatherPlan,
  ]);

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
    budgetProfile.transport * Math.ceil(itinerary.days / 3),
    50
  );

  const applyTripPayload = useCallback((payload: TripPayload) => {
    if (isPlanningMode(payload.planningMode ?? null)) {
      setPlanningModeState(payload.planningMode);
    }
    if (isPlanningTemplateId(payload.planningTemplateId ?? null)) {
      setPlanningTemplateId(payload.planningTemplateId);
    }
    setPlannerBaseId(payload.plannerBaseId ?? "mobay");
    setPlannerDays(clampPlannerDays(payload.plannerDays ?? 5));
    setPlannerVibe((payload.plannerVibe as Vibe) ?? "mixed");
    setPlannerBudget(clampPlannerBudget(payload.plannerBudget ?? 150));
    if (payload.plannerStartDate) {
      setPlannerStartDate(payload.plannerStartDate);
    }
    if (payload.originAirportId && ORIGIN_AIRPORTS.some((airport) => airport.id === payload.originAirportId)) {
      setOriginAirportId(payload.originAirportId);
    }
    setManualRouteDestinationIds(
      normalizeRouteDestinationIds(payload.manualRouteDestinationIds ?? [], payload.plannerBaseId ?? "mobay", payload.plannerDays ?? 5)
    );
    setLockedRouteDestinationIds(
      normalizeRouteDestinationIds(payload.lockedRouteDestinationIds ?? [], payload.plannerBaseId ?? "mobay", payload.plannerDays ?? 5)
    );
    setDayExperienceOverrides(normalizeDayExperienceOverrides(payload.dayExperienceOverrides ?? {}, payload.plannerDays ?? 5));
    setDayNotes(normalizeDayNotes(payload.dayNotes ?? {}, payload.plannerDays ?? 5));
    setImportedIdeaDayAssignments(
      normalizeImportedIdeaDayAssignments(payload.importedIdeaDayAssignments ?? {}, payload.plannerDays ?? 5, payload.importedIdeas ?? [])
    );
    setSavedPlaces(new Set(payload.savedPlaces ?? []));
    setSavedExperiences(new Set(payload.savedExperiences ?? []));
    setImportedIdeas(payload.importedIdeas ?? []);
  }, []);

  const applyCloudBoard = useCallback((payload: CloudBoardPayload) => {
    setSavedPlaces(new Set(payload.savedPlaces ?? []));
    setSavedExperiences(new Set(payload.savedExperiences ?? []));
    setImportedIdeas(payload.importedIdeas ?? []);
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
        const storedEditToken = getStoredTripEditToken(sharedTripId);
        setTripId(sharedTripId);
        setTripEditToken(storedEditToken);
        setTripShareUrl(buildShareUrl(sharedTripId));
        setTripStatusMessage(
          storedEditToken
            ? "Shared trip loaded. You can update this link."
            : "Shared trip loaded as view-only. Share again to save your own copy."
        );
        setCollaborationErrorCode(null);
      })
      .catch((error) => {
        logRecoverableWarning("Shared trip load unavailable.", error);
        if (!cancelled) {
          setTripStatusMessage(getCollaborationErrorMessage(error));
          setCollaborationErrorCode(getCollaborationErrorCode(error));
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
    writeStringToStorage(STORAGE_KEY_ORIGIN_AIRPORT, airportId);
  };

  const applyPlanningTemplate = useCallback((templateId: PlanningTemplateId) => {
    const template = getPlanningTemplate(templateId);
    setPlanningModeState(template.mode);
    setPlanningTemplateId(template.id);
    setPlannerBaseId(template.baseId);
    setPlannerDays(clampPlannerDays(template.days));
    setPlannerVibe(template.vibe);
    setPlannerBudget(clampPlannerBudget(template.budget));
    setManualRouteDestinationIds(
      normalizeRouteDestinationIds(template.routeDestinationIds ?? [], template.baseId, template.days)
    );
    setLockedRouteDestinationIds([]);
    setDayExperienceOverrides({});
    setDayNotes({});
    setImportedIdeaDayAssignments({});

    if (template.originAirportId && ORIGIN_AIRPORTS.some((airport) => airport.id === template.originAirportId)) {
      setOriginAirportId(template.originAirportId);
      writeStringToStorage(STORAGE_KEY_ORIGIN_AIRPORT, template.originAirportId);
      setHasUserPreferredOrigin(true);
    }
  }, []);

  const buildTripFromDestinations = useCallback((destinationIds: string[], templateId?: PlanningTemplateId) => {
    const template = getPlanningTemplate(templateId ?? planningTemplateId);
    const validDestinationIds = new Set(DESTINATIONS.map((item) => item.id));
    const selectedDestinationIds = Array.from(new Set(destinationIds)).filter((id) => validDestinationIds.has(id));
    const baseId = selectedDestinationIds[0] ?? template.baseId;
    const routeDestinationIds = selectedDestinationIds.length > 1
      ? selectedDestinationIds.slice(1)
      : template.routeDestinationIds ?? [];
    const targetDays = clampPlannerDays(
      Math.max(template.days, selectedDestinationIds.length || 1)
    );

    setPlanningModeState(template.mode);
    setPlanningTemplateId(template.id);
    setPlannerBaseId(baseId);
    setPlannerDays(targetDays);
    setPlannerVibe(template.vibe);
    setPlannerBudget(clampPlannerBudget(template.budget));
    setManualRouteDestinationIds(
      normalizeRouteDestinationIds(routeDestinationIds, baseId, targetDays)
    );
    setLockedRouteDestinationIds([]);
    setDayExperienceOverrides({});
    setDayNotes({});
    setImportedIdeaDayAssignments({});
    setSavedPlaces((prev) => {
      const next = new Set(prev);
      selectedDestinationIds.forEach((id) => next.add(id));
      return next;
    });

    if (template.originAirportId && ORIGIN_AIRPORTS.some((airport) => airport.id === template.originAirportId)) {
      setOriginAirportId(template.originAirportId);
      writeStringToStorage(STORAGE_KEY_ORIGIN_AIRPORT, template.originAirportId);
      setHasUserPreferredOrigin(true);
    }
  }, [planningTemplateId]);

  const setPlanningMode = useCallback((mode: PlanningMode) => {
    applyPlanningTemplate(getDefaultTemplateForMode(mode).id);
  }, [applyPlanningTemplate]);

  const handlePlannerDaysChange = (days: number) => {
    setPlannerDays(clampPlannerDays(days));
  };

  const handlePlannerBudgetChange = (budget: number) => {
    setPlannerBudget(clampPlannerBudget(budget));
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

  const addImportedIdea = (idea: Omit<ImportedIdea, "id" | "createdAt">) => {
    const importedIdea: ImportedIdea = {
      ...idea,
      id: createImportedIdeaId(),
      createdAt: new Date().toISOString(),
    };
    setImportedIdeas((prev) => [importedIdea, ...prev]);
    return importedIdea;
  };

  const updateImportedIdea = (id: string, patch: Partial<Omit<ImportedIdea, "id" | "createdAt">>) => {
    setImportedIdeas((prev) =>
      prev.map((idea) => (idea.id === id ? { ...idea, ...patch } : idea))
    );
  };

  const removeImportedIdea = (id: string) => {
    setImportedIdeas((prev) => prev.filter((idea) => idea.id !== id));
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
      setTripStatusMessage("Choose a trip start date before exporting.");
      return;
    }
    if (!itinerary.daysPlan.length) {
      setTripStatusMessage("Add at least one itinerary day before exporting.");
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
      setTripStatusMessage("Calendar file downloaded.");
    } catch (error) {
      logRecoverableWarning("Calendar export unavailable.", error);
      setTripStatusMessage("Calendar export could not be created right now.");
    }
  };

  const handleShareTrip = async () => {
    if (!collaborationReady) {
      setTripStatusMessage("Share links are not connected yet. Calendar export still works.");
      setCollaborationErrorCode("not-configured");
      return;
    }
    setIsSyncingTrip(true);
    setTripStatusMessage(null);
    try {
      const payload = serializeTripState({
        planningMode,
        planningTemplateId,
        plannerBaseId,
        plannerDays,
        plannerVibe,
        plannerBudget,
        plannerStartDate,
        originAirportId,
        manualRouteDestinationIds,
        lockedRouteDestinationIds,
        dayExperienceOverrides,
        dayNotes,
        importedIdeaDayAssignments,
        savedPlaces,
        savedExperiences,
        importedIdeas,
      });
      const targetTripId = tripEditToken ? tripId : null;
      const result = await saveTripState(targetTripId, payload, tripEditToken);
      rememberTripEditToken(result.id, result.editToken);
      setTripEditToken(result.editToken);
      const id = result.id;
      setTripId(id);
      const shareUrl = buildShareUrl(id);
      setTripShareUrl(shareUrl);
      updateUrlWithTrip(shareUrl);
      setTripStatusMessage(result.mode === "updated" ? "Share link updated" : "Share link created");
      setCollaborationErrorCode(null);
    } catch (error) {
      logRecoverableWarning("Share link update unavailable.", error);
      setTripStatusMessage(getCollaborationErrorMessage(error));
      setCollaborationErrorCode(getCollaborationErrorCode(error));
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
      logRecoverableWarning("Clipboard copy unavailable.", error);
      setTripStatusMessage("Copy unavailable");
    }
  };

  const moveRouteStop = (destinationId: string, direction: -1 | 1) => {
    if (destinationId === destination.id) return;
    setManualRouteDestinationIds((prev) => {
      const lockedIds = new Set(lockedRouteDestinationIds);
      if (lockedIds.has(destinationId)) return prev;

      const currentRoute = prev.length
        ? prev
        : itinerary.routeSummary.stops.slice(1).map((stop) => stop.destinationId);
      const next = normalizeRouteDestinationIds(currentRoute, destination.id, plannerDays);
      const index = next.indexOf(destinationId);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= next.length) return next;
      if (lockedIds.has(next[targetIndex])) return next;

      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const pinDestinationToRoute = (destinationId: string) => {
    if (destinationId === destination.id) return;
    if (!DESTINATIONS.some((item) => item.id === destinationId)) return;
    savePlace(destinationId);
    setManualRouteDestinationIds((prev) => {
      const maxStops = Math.max(0, clampPlannerDays(plannerDays) - 1);
      const lockedIds = new Set(lockedRouteDestinationIds);
      const currentRoute = prev.length
        ? prev
        : itinerary.routeSummary.stops.slice(1).map((stop) => stop.destinationId);
      const withoutPinnedDestination = currentRoute.filter((id) => id !== destinationId);
      const nextRoute = appendRouteDestination(withoutPinnedDestination, destinationId, lockedIds, maxStops);
      return normalizeRouteDestinationIds(nextRoute, destination.id, plannerDays);
    });
    setLockedRouteDestinationIds((prev) => prev.filter((id) => id !== destinationId));
  };

  const removeDestinationFromRoute = (destinationId: string) => {
    if (destinationId === destination.id) return;
    setManualRouteDestinationIds((prev) => {
      const currentRoute = prev.length
        ? prev
        : itinerary.routeSummary.stops.slice(1).map((stop) => stop.destinationId);
      return normalizeRouteDestinationIds(
        currentRoute.filter((id) => id !== destinationId),
        destination.id,
        plannerDays
      );
    });
    setLockedRouteDestinationIds((prev) => prev.filter((id) => id !== destinationId));
  };

  const optimizeRouteOrder = () => {
    const currentRouteIds = new Set(itinerary.routeSummary.stops.map((stop) => stop.destinationId));
    const currentManualRouteIds = itinerary.routeSummary.stops.slice(1).map((stop) => stop.destinationId);
    const lockedIds = new Set(lockedRouteDestinationIds);
    const candidatePool = [
      destination,
      ...DESTINATIONS.filter((item) => item.id !== destination.id && currentRouteIds.has(item.id)),
    ];
    const optimized = buildRouteOrder(destination, candidatePool, currentRouteIds, plannerVibe, plannerDays)
      .slice(1)
      .map((item) => item.id);
    setManualRouteDestinationIds(
      normalizeRouteDestinationIds(
        mergeLockedRouteOrder(currentManualRouteIds, optimized, lockedIds),
        destination.id,
        plannerDays
      )
    );
  };

  const resetRouteOrder = () => {
    setManualRouteDestinationIds([]);
    setLockedRouteDestinationIds([]);
  };

  const toggleRouteStopLock = (destinationId: string) => {
    if (destinationId === destination.id) return;
    setManualRouteDestinationIds((prev) => (
      prev.length ? prev : itinerary.routeSummary.stops.slice(1).map((stop) => stop.destinationId)
    ));
    setLockedRouteDestinationIds((prev) => {
      const normalized = normalizeRouteDestinationIds(prev, destination.id, plannerDays);
      return normalized.includes(destinationId)
        ? normalized.filter((id) => id !== destinationId)
        : normalizeRouteDestinationIds([...normalized, destinationId], destination.id, plannerDays);
    });
  };

  const setRouteStopForDay = (day: number, destinationId: string) => {
    const safeDay = Math.round(day);
    const targetDestination = DESTINATIONS.find((item) => item.id === destinationId);
    if (!targetDestination || safeDay < 1 || safeDay > plannerDays) return;

    const currentDayDestinationId = itinerary.daysPlan[safeDay - 1]?.destinationId;
    const lockedIds = new Set(lockedRouteDestinationIds);
    if (currentDayDestinationId && currentDayDestinationId !== targetDestination.id && lockedIds.has(currentDayDestinationId)) return;
    if (lockedIds.has(targetDestination.id) && currentDayDestinationId !== targetDestination.id) return;

    const currentRoute = manualRouteDestinationIds.length
      ? manualRouteDestinationIds
      : itinerary.routeSummary.stops.slice(1).map((stop) => stop.destinationId);
    const dayKey = String(safeDay);

    if (safeDay === 1) {
      setPlannerBaseId(targetDestination.id);
      savePlace(targetDestination.id);
      setManualRouteDestinationIds(
        normalizeRouteDestinationIds(currentRoute, targetDestination.id, plannerDays)
      );
      setLockedRouteDestinationIds((prev) =>
        normalizeRouteDestinationIds(
          prev.filter((id) => id !== targetDestination.id),
          targetDestination.id,
          plannerDays
        )
      );
    } else {
      const targetIndex = safeDay - 2;
      savePlace(targetDestination.id);
      setManualRouteDestinationIds(() =>
        normalizeRouteDestinationIds(
          setRouteDestinationAtIndex(currentRoute, destination.id, targetDestination.id, targetIndex, plannerDays),
          destination.id,
          plannerDays
        )
      );
    }

    setDayExperienceOverrides((prev) => {
      if (!prev[dayKey]) return prev;
      const next = { ...prev };
      delete next[dayKey];
      return next;
    });
  };

  const setDayExperience = (day: number, experienceId: string) => {
    const safeDay = Math.round(day);
    if (safeDay < 1 || safeDay > plannerDays) return;
    if (!EXPERIENCES.some((experience) => experience.id === experienceId)) return;
    saveExperience(experienceId);
    setDayExperienceOverrides((prev) => ({
      ...prev,
      [String(safeDay)]: experienceId,
    }));
  };

  const clearDayExperience = (day: number) => {
    const safeDay = Math.round(day);
    setDayExperienceOverrides((prev) => {
      const key = String(safeDay);
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const refreshDayExperience = (day: number) => {
    const safeDay = Math.round(day);
    if (safeDay < 1 || safeDay > plannerDays) return;

    const itineraryDay = itinerary.daysPlan[safeDay - 1];
    if (!itineraryDay) return;

    const options = getExperienceOptionsForDay(itineraryDay, EXPERIENCES.length, savedExperiences);
    if (!options.length) return;

    const currentExperienceId = dayExperienceOverrides[String(safeDay)] ?? itineraryDay.experience?.id;
    const currentIndex = options.findIndex((experience) => experience.id === currentExperienceId);
    const nextExperience = options[(currentIndex + 1) % options.length] ?? options[0];
    if (!nextExperience || nextExperience.id === currentExperienceId) return;

    saveExperience(nextExperience.id);
    setDayExperienceOverrides((prev) => ({
      ...prev,
      [String(safeDay)]: nextExperience.id,
    }));
  };

  const setDayNote = (day: number, note: string) => {
    const safeDay = Math.round(day);
    if (safeDay < 1 || safeDay > plannerDays) return;
    const key = String(safeDay);
    const normalizedNote = note.slice(0, 280);
    setDayNotes((prev) => {
      if (!normalizedNote.trim()) {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: normalizedNote,
      };
    });
  };

  const clearDayNote = (day: number) => {
    const safeDay = Math.round(day);
    const key = String(safeDay);
    setDayNotes((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const assignImportedIdeaToDay = (ideaId: string, day: number) => {
    const safeDay = Math.round(day);
    if (safeDay < 1 || safeDay > plannerDays) return;
    if (!importedIdeas.some((idea) => idea.id === ideaId)) return;
    setImportedIdeaDayAssignments((prev) => ({
      ...prev,
      [ideaId]: String(safeDay),
    }));
  };

  const clearImportedIdeaDayAssignment = (ideaId: string) => {
    setImportedIdeaDayAssignments((prev) => {
      if (!prev[ideaId]) return prev;
      const next = { ...prev };
      delete next[ideaId];
      return next;
    });
  };

  useEffect(() => {
    if (!tripId || !tripEditToken || !collaborationReady) return;
    const payload = serializeTripState({
      planningMode,
      planningTemplateId,
      plannerBaseId,
      plannerDays,
      plannerVibe,
      plannerBudget,
      plannerStartDate,
      originAirportId,
      manualRouteDestinationIds,
      lockedRouteDestinationIds,
      dayExperienceOverrides,
      dayNotes,
      importedIdeaDayAssignments,
      savedPlaces,
      savedExperiences,
      importedIdeas,
    });

    const handler = setTimeout(() => {
      setIsSyncingTrip(true);
      saveTripState(tripId, payload, tripEditToken)
        .then(() => {
          setTripStatusMessage("Trip updated");
          setCollaborationErrorCode(null);
        })
        .catch((error) => {
          logRecoverableWarning("Shared trip auto-save unavailable.", error);
          setTripStatusMessage(getCollaborationErrorMessage(error));
          setCollaborationErrorCode(getCollaborationErrorCode(error));
        })
        .finally(() => setIsSyncingTrip(false));
    }, 1500);

    return () => clearTimeout(handler);
  }, [
    tripId,
    tripEditToken,
    collaborationReady,
    planningMode,
    planningTemplateId,
    plannerBaseId,
    plannerDays,
    plannerVibe,
    plannerBudget,
    plannerStartDate,
    originAirportId,
    manualRouteDestinationIds,
    lockedRouteDestinationIds,
    dayExperienceOverrides,
    dayNotes,
    importedIdeaDayAssignments,
    savedPlaces,
    savedExperiences,
    importedIdeas,
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
    importedIdeas,
    theme,
    toggleTheme: () => setTheme((prev) => (prev === "dark" ? "light" : "dark")),
    planningMode,
    setPlanningMode,
    planningTemplateId,
    planningTemplates,
    activePlanningTemplate,
    applyPlanningTemplate,
    buildTripFromDestinations,
    applyCloudBoard,
    plannerBaseId,
    setPlannerBaseId,
    plannerDays,
    setPlannerDays: handlePlannerDaysChange,
    plannerVibe,
    setPlannerVibe,
    plannerBudget,
    setPlannerBudget: handlePlannerBudgetChange,
    plannerStartDate,
    setPlannerStartDate,
    manualRouteDestinationIds,
    lockedRouteDestinationIds,
    dayExperienceOverrides,
    dayNotes,
    importedIdeaDayAssignments,
    routeIsManual: manualRouteDestinationIds.length > 0,
    originAirportId,
    handleOriginAirportChange,
    originAirports: ORIGIN_AIRPORTS,
    liveFacts,
    isFetchingFacts,
    flightOptions,
    isFetchingFlights,
    flightsError,
    liveFlightProviderConfigured: flightSourceMeta.source === "aviationstack",
    flightSourceMeta,
    mapViewState,
    handleMapMove,
    tripId,
    tripCanEdit: Boolean(tripId && tripEditToken),
    tripShareUrl,
    isSyncingTrip,
    tripStatusMessage,
    collaborationErrorCode,
    collaborationReady,
    liveEvents,
    isLoadingEvents,
    eventsError,
    loadEvents,
    bookingOptions,
    isLoadingBookings,
    bookingError,
    bookingSourceMeta,
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
    addImportedIdea,
    updateImportedIdea,
    removeImportedIdea,
    moveRouteStop,
    pinDestinationToRoute,
    removeDestinationFromRoute,
    optimizeRouteOrder,
    resetRouteOrder,
    toggleRouteStopLock,
    setRouteStopForDay,
    setDayExperience,
    clearDayExperience,
    refreshDayExperience,
    setDayNote,
    clearDayNote,
    assignImportedIdeaToDay,
    clearImportedIdeaDayAssignment,
    handleExportItinerary,
    handleShareTrip,
    handleCopyShareLink,
  };
}

export type TravelOS = ReturnType<typeof useTravelOS>;

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";

  const savedTheme = readStringFromStorage(STORAGE_KEY_THEME);
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;

  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function getInitialOriginAirportId(): string {
  return getStoredOriginAirportId() ?? DEFAULT_ORIGIN_AIRPORT_ID;
}

function getInitialPlanningMode(): PlanningMode {
  const savedMode = readStringFromStorage(STORAGE_KEY_PLANNING_MODE);
  return isPlanningMode(savedMode) ? savedMode : DEFAULT_PLANNING_MODE;
}

function getInitialPlanningTemplateId(): PlanningTemplateId {
  const savedTemplate = readStringFromStorage(STORAGE_KEY_PLANNING_TEMPLATE);
  if (isPlanningTemplateId(savedTemplate)) return savedTemplate;

  const savedMode = readStringFromStorage(STORAGE_KEY_PLANNING_MODE);
  const mode = isPlanningMode(savedMode) ? savedMode : DEFAULT_PLANNING_MODE;
  return getDefaultTemplateForMode(mode).id ?? DEFAULT_PLANNING_TEMPLATE_ID;
}

function normalizeDayExperienceOverrides(
  overrides: DayExperienceOverrides,
  plannerDays: number
): DayExperienceOverrides {
  const validExperienceIds = new Set(EXPERIENCES.map((experience) => experience.id));
  const safeDays = clampPlannerDays(plannerDays);

  return Object.fromEntries(
    Object.entries(overrides).filter(([day, experienceId]) => {
      const dayNumber = Number(day);
      return Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= safeDays && validExperienceIds.has(experienceId);
    })
  );
}

function normalizeDayNotes(notes: DayNotes, plannerDays: number): DayNotes {
  const safeDays = clampPlannerDays(plannerDays);

  return Object.fromEntries(
    Object.entries(notes)
      .map(([day, note]) => [day, note.slice(0, 280)] as const)
      .filter(([day, note]) => {
        const dayNumber = Number(day);
        return Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= safeDays && Boolean(note.trim());
      })
  );
}

function normalizeImportedIdeaDayAssignments(
  assignments: ImportedIdeaDayAssignments,
  plannerDays: number,
  importedIdeas: ImportedIdea[]
): ImportedIdeaDayAssignments {
  const safeDays = clampPlannerDays(plannerDays);
  const validIdeaIds = new Set(importedIdeas.map((idea) => idea.id));

  return Object.fromEntries(
    Object.entries(assignments).filter(([ideaId, day]) => {
      const dayNumber = Number(day);
      return validIdeaIds.has(ideaId) && Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= safeDays;
    })
  );
}

function stringRecordsEqual(first: Record<string, string>, second: Record<string, string>): boolean {
  const firstKeys = Object.keys(first);
  const secondKeys = Object.keys(second);
  return firstKeys.length === secondKeys.length && firstKeys.every((key) => first[key] === second[key]);
}

function mergeLockedRouteOrder(currentRouteIds: string[], optimizedRouteIds: string[], lockedIds: Set<string>): string[] {
  if (!lockedIds.size) return optimizedRouteIds;

  const optimizedQueue = optimizedRouteIds.filter((id) => !lockedIds.has(id));
  return currentRouteIds.map((currentId) => {
    if (lockedIds.has(currentId)) return currentId;
    return optimizedQueue.shift() ?? currentId;
  });
}

function appendRouteDestination(
  currentRouteIds: string[],
  destinationId: string,
  lockedIds: Set<string>,
  maxStops: number
): string[] {
  if (maxStops <= 0) return [];

  const nextRouteIds = [...currentRouteIds, destinationId];
  while (nextRouteIds.length > maxStops) {
    const removableIndex = findLastIndex(
      nextRouteIds,
      (id) => id !== destinationId && !lockedIds.has(id)
    );
    if (removableIndex < 0) return currentRouteIds;
    nextRouteIds.splice(removableIndex, 1);
  }

  return nextRouteIds;
}

function setRouteDestinationAtIndex(
  currentRouteIds: string[],
  baseId: string,
  destinationId: string,
  targetIndex: number,
  plannerDays: number
): string[] {
  const maxStops = Math.max(0, clampPlannerDays(plannerDays) - 1);
  if (targetIndex < 0 || targetIndex >= maxStops) return currentRouteIds;

  const nextRouteIds = [...currentRouteIds];
  if (destinationId === baseId) {
    nextRouteIds.splice(targetIndex, 1);
    return nextRouteIds;
  }

  const existingIndex = nextRouteIds.indexOf(destinationId);
  if (existingIndex >= 0) {
    [nextRouteIds[targetIndex], nextRouteIds[existingIndex]] = [nextRouteIds[existingIndex], nextRouteIds[targetIndex]];
    return nextRouteIds;
  }

  while (nextRouteIds.length <= targetIndex) {
    const filler = DESTINATIONS.find(
      (item) => item.id !== baseId && item.id !== destinationId && !nextRouteIds.includes(item.id)
    );
    if (!filler) break;
    nextRouteIds.push(filler.id);
  }

  nextRouteIds[targetIndex] = destinationId;
  return nextRouteIds;
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }
  return -1;
}

function getStoredOriginAirportId(): string | null {
  const storedOrigin = readStringFromStorage(STORAGE_KEY_ORIGIN_AIRPORT);
  return storedOrigin && ORIGIN_AIRPORTS.some((airport) => airport.id === storedOrigin)
    ? storedOrigin
    : null;
}

function isImportedIdeaArray(value: unknown): value is ImportedIdea[] {
  return Array.isArray(value) && value.every(isImportedIdea);
}

function isImportedIdea(value: unknown): value is ImportedIdea {
  if (typeof value !== "object" || value === null) return false;
  const idea = value as Partial<Record<keyof ImportedIdea, unknown>>;
  return (
    typeof idea.id === "string" &&
    typeof idea.title === "string" &&
    typeof idea.url === "string" &&
    typeof idea.note === "string" &&
    typeof idea.category === "string" &&
    typeof idea.collectionId === "string" &&
    typeof idea.createdAt === "string" &&
    (idea.linkedDestinationId === undefined || typeof idea.linkedDestinationId === "string") &&
    (idea.sourcePlatform === undefined || typeof idea.sourcePlatform === "string") &&
    (idea.sourceLabel === undefined || typeof idea.sourceLabel === "string") &&
    (idea.extractedPlaceName === undefined || typeof idea.extractedPlaceName === "string") &&
    (idea.description === undefined || typeof idea.description === "string") &&
    (idea.imageUrl === undefined || typeof idea.imageUrl === "string") &&
    (idea.siteName === undefined || typeof idea.siteName === "string") &&
    (idea.canonicalUrl === undefined || typeof idea.canonicalUrl === "string") &&
    (idea.place === undefined || isImportedIdeaPlaceMetadata(idea.place))
  );
}

function isImportedIdeaPlaceMetadata(value: unknown): value is ImportedIdea["place"] {
  if (typeof value !== "object" || value === null) return false;
  const place = value as Partial<Record<keyof NonNullable<ImportedIdea["place"]>, unknown>>;
  return (
    (place.name === undefined || typeof place.name === "string") &&
    (place.address === undefined || typeof place.address === "string") &&
    (place.shortAddress === undefined || typeof place.shortAddress === "string") &&
    (place.latitude === undefined || typeof place.latitude === "number") &&
    (place.longitude === undefined || typeof place.longitude === "number") &&
    (place.mapsUrl === undefined || typeof place.mapsUrl === "string") &&
    (place.websiteUrl === undefined || typeof place.websiteUrl === "string") &&
    (place.phone === undefined || typeof place.phone === "string") &&
    (place.rating === undefined || typeof place.rating === "number") &&
    (place.userRatingCount === undefined || typeof place.userRatingCount === "number") &&
    (place.primaryType === undefined || typeof place.primaryType === "string") &&
    (place.types === undefined || (Array.isArray(place.types) && place.types.every((type) => typeof type === "string")))
  );
}

type OpenMeteoDailyForecast = {
  time?: unknown;
  weather_code?: unknown;
  weathercode?: unknown;
  temperature_2m_max?: unknown;
  temperature_2m_min?: unknown;
  precipitation_probability_max?: unknown;
  precipitation_sum?: unknown;
};

function parseWeatherPlanDays(payload: unknown): WeatherPlanDay[] {
  if (typeof payload !== "object" || payload === null) return [];

  const daily = (payload as { daily?: OpenMeteoDailyForecast }).daily;
  if (!daily) return [];

  const dates = readStringArray(daily.time);
  const weatherCodes = readNumberArray(daily.weather_code ?? daily.weathercode);
  const maxTemps = readNumberArray(daily.temperature_2m_max);
  const minTemps = readNumberArray(daily.temperature_2m_min);
  const precipitationProbabilities = readNumberArray(daily.precipitation_probability_max);
  const precipitationTotals = readNumberArray(daily.precipitation_sum);

  return dates.map((date, index) => {
    const weatherCode = getNumberAt(weatherCodes, index, 3);
    const maxTempC = getNumberAt(maxTemps, index, 0);
    const minTempC = getNumberAt(minTemps, index, 0);
    const precipitationProbability = getNumberAt(precipitationProbabilities, index, 0);
    const precipitationMm = getNumberAt(precipitationTotals, index, 0);
    const condition = describeWeatherCode(weatherCode);

    return {
      date,
      condition,
      summary: formatWeatherSummary(condition, maxTempC, precipitationProbability),
      maxTempC,
      minTempC,
      precipitationProbability,
      precipitationMm,
      weatherCode,
      planningSignal: getWeatherPlanningSignal(
        weatherCode,
        maxTempC,
        precipitationProbability,
        precipitationMm
      ),
    };
  });
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map((item) => Number(item)) : [];
}

function getNumberAt(values: number[], index: number, fallback: number): number {
  const value = values[index];
  return Number.isFinite(value) ? value : fallback;
}

function describeWeatherCode(code: number): string {
  if (code === 0) return "Clear";
  if (code >= 1 && code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Showers";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95) return "Thunderstorms";
  return "Mixed skies";
}

function getWeatherPlanningSignal(
  code: number,
  maxTempC: number,
  precipitationProbability: number,
  precipitationMm: number
): WeatherPlanDay["planningSignal"] {
  if (code >= 95) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (precipitationProbability >= 60 || precipitationMm >= 8) return "rain";
  if (maxTempC >= 32) return "hot";
  if (code !== 0) return "cloudy";
  return "clear";
}

function formatWeatherSummary(condition: string, maxTempC: number, precipitationProbability: number): string {
  const temperature = Number.isFinite(maxTempC) ? `${Math.round(maxTempC)}°C high` : "Forecast";
  const rainChance = Number.isFinite(precipitationProbability)
    ? `${Math.round(precipitationProbability)}% rain`
    : "rain unknown";
  return `${condition} · ${temperature} · ${rainChance}`;
}

function createImportedIdeaId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function estimateFlightDuration(origin: OriginAirport, destination: Pick<Destination, "latitude" | "longitude">): string {
  const distanceKm = haversineDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
  const hours = distanceKm / AVERAGE_JET_SPEED_KMH;
  return formatFlightDuration(hours);
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
  return formatLocalTimeForAirport(dateString, airportCode, AIRPORT_TIMEZONES);
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
      day.routeNote,
      day.driveMinutesFromPrevious ? `Transfer: ${day.distanceFromPreviousKm} km · ${formatDriveTime(day.driveMinutesFromPrevious)}` : null,
      day.weather ? `Weather: ${day.weather.summary}` : null,
      day.weatherNote ? `Weather planning: ${day.weatherNote}` : null,
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
