import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Music2, PartyPopper, Utensils } from "lucide-react";
import { DESTINATIONS, EXPERIENCES, EXPERIENCE_TYPES, VIBE_OPTIONS } from "../data/content";
import {
  BookingOption,
  Destination,
  ExperienceType,
  FlightOption,
  ItineraryPlan,
  OriginAirport,
  QuickFact,
  Vibe,
  LiveEvent,
} from "../types/travel";
import { classNames } from "../utils/classNames";
import { HeroSection } from "../components/HeroSection";
import { PlacesGrid } from "../components/PlacesGrid";
import { ExperiencesGrid } from "../components/ExperiencesGrid";
import { ExperiencesHighlight } from "../components/ExperiencesHighlight";
import { ItineraryView } from "../components/ItineraryView";
import { PageFooter } from "../components/PageFooter";
import { TravelMap } from "../components/TravelMap";
import { LiveEventsFeed } from "../components/LiveEventsFeed";
import { BudgetInsight } from "../components/BudgetInsight";
import { BookingRecommendations } from "../components/BookingRecommendations";
import { fetchFlightOptions } from "../services/flights";
import {
  TripPayload,
  fetchTripState,
  hasCollaborationBackend,
  saveTripState,
  serializeTripState,
} from "../services/collab";
import { fetchBookingOptions } from "../services/bookings";

const EARTH_RADIUS_KM = 6371;
const AVERAGE_JET_SPEED_KMH = 850;
const STORAGE_KEY_ORIGIN_AIRPORT = "irieverse_origin_airport";

const AIRPORT_TIMEZONES: Record<string, string> = {
  JFK: "America/New_York",
  MIA: "America/New_York",
  YYZ: "America/Toronto",
  LAX: "America/Los_Angeles",
  SCL: "America/Santiago",
  MBJ: "America/Jamaica",
  KIN: "America/Jamaica",
  NEG: "America/Jamaica",
  OCJ: "America/Jamaica"
};

const ORIGIN_AIRPORTS: OriginAirport[] = [
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

const STORAGE_KEY_SAVED_PLACES = "irieverse_saved_places";
const STORAGE_KEY_SAVED_EXPERIENCES = "irieverse_saved_experiences";
const STORAGE_KEY_THEME = "irieverse_theme";

type ViewMode = "places" | "experiences";
type ThemeMode = "dark" | "light";

export function HomePage() {
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
  const collaborationReady = hasCollaborationBackend();
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [bookingOptions, setBookingOptions] = useState<BookingOption[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

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
        // user denied or unavailable; keep defaults
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
    const destination = DESTINATIONS.find((item) => item.id === plannerBaseId);
    if (!destination) {
      setLiveFacts(null);
      setFlightOptions([]);
      return;
    }

    const originAirport = ORIGIN_AIRPORTS.find((airport) => airport.id === originAirportId) ?? ORIGIN_AIRPORTS[0];

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
      const destinationAirportCode = destination.airportCode;
      const originAirport = ORIGIN_AIRPORTS.find((airport) => airport.id === originAirportId) ?? ORIGIN_AIRPORTS[0];
      try {
        const flights = await fetchFlightOptions(originAirport.code, destinationAirportCode);
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
  }, [plannerBaseId, originAirportId]);

  const loadEvents = useCallback(async () => {
    const destination =
      DESTINATIONS.find((destinationItem) => destinationItem.id === plannerBaseId) ?? DESTINATIONS[0];
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
  }, [plannerBaseId]);

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

  useEffect(() => {
    const destination = DESTINATIONS.find((destinationItem) => destinationItem.id === plannerBaseId) ?? DESTINATIONS[0];
    const originAirport = ORIGIN_AIRPORTS.find((airport) => airport.id === originAirportId) ?? ORIGIN_AIRPORTS[0];
    loadBookings(destination.airportCode, originAirport.code);
  }, [plannerBaseId, originAirportId, loadBookings]);

  const filteredDestinations = useMemo(() => {
    let items = [...DESTINATIONS];

    if (vibe !== "all") {
      items = items.filter((destination) => destination.vibes.includes(vibe));
    }

    if (search) {
      const query = search.toLowerCase();
      items = items.filter(
        (destination) =>
          destination.name.toLowerCase().includes(query) ||
          destination.region.toLowerCase().includes(query) ||
          destination.description.toLowerCase().includes(query) ||
          destination.headline.toLowerCase().includes(query)
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
    const base = DESTINATIONS.find((destination) => destination.id === plannerBaseId) ?? DESTINATIONS[0];
    const placePool = DESTINATIONS.slice()
      .sort((a, b) => b.rating - a.rating)
      .filter((destination) => plannerVibe === "mixed" || destination.vibes.includes(plannerVibe) || destination.id === base.id);

    const expPool = EXPERIENCES.slice().sort((a, b) => b.rating - a.rating);

    const daysPlan = Array.from({ length: plannerDays }, (_, index) => {
      const destination = placePool[index % placePool.length];
      const destinationVibe = plannerVibe === "mixed" ? destination.vibes[0] ?? "chill" : plannerVibe;
      const highlight = destination.highlights[index % destination.highlights.length] ?? destination.highlights[0];
      const matchedExperiences = expPool.filter(
        (experience) =>
          experience.linkedDestinationId === destination.id ||
          experience.region === destination.region ||
          experience.vibes.includes(destinationVibe)
      );
      const experience = matchedExperiences[0] ?? expPool[index % expPool.length];

      return {
        day: index + 1,
        destName: destination.name,
        destRegion: destination.region,
        vibe: destinationVibe,
        highlight,
        suggestedBudget: plannerBudget,
        isBase: destination.id === base.id,
        experience,
      };
    });

    return {
      base,
      days: plannerDays,
      plannerVibe,
      budgetPerDay: plannerBudget,
      daysPlan,
    };
  }, [plannerBaseId, plannerBudget, plannerDays, plannerVibe]);

  const heroVideoUrl = "/media/hero.mp4";
  const destination = DESTINATIONS.find((destinationItem) => destinationItem.id === plannerBaseId) ?? DESTINATIONS[0];
  const destinationFacts = destination.quickFacts;
  const originAirport = ORIGIN_AIRPORTS.find((airport) => airport.id === originAirportId) ?? ORIGIN_AIRPORTS[0];
  const defaultFlightFact: QuickFact = {
    label: `From ${originAirport.shortLabel ?? originAirport.code}`,
    value: estimateFlightDuration(originAirport, destination),
  };
  const heroFacts =
    (!isFetchingFacts && liveFacts?.length ? liveFacts : null) ??
    destinationFacts ?? [
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

  const applyTripPayload = useCallback(
    (payload: TripPayload) => {
      setPlannerBaseId(payload.plannerBaseId ?? "mobay");
      setPlannerDays(payload.plannerDays ?? 5);
      setPlannerVibe((payload.plannerVibe as Vibe) ?? "mixed");
      setPlannerBudget(payload.plannerBudget ?? 150);
      if (payload.plannerStartDate) {
        setPlannerStartDate(payload.plannerStartDate);
      }
      if (payload.originAirportId && ORIGIN_AIRPORTS.some((a) => a.id === payload.originAirportId)) {
        setOriginAirportId(payload.originAirportId);
      }
      setSavedPlaces(new Set(payload.savedPlaces ?? []));
      setSavedExperiences(new Set(payload.savedExperiences ?? []));
    },
    []
  );

  const handleOriginAirportChange = (airportId: string) => {
    setOriginAirportId(airportId);
    setHasUserPreferredOrigin(true);
    localStorage.setItem(STORAGE_KEY_ORIGIN_AIRPORT, airportId);
  };

  const handleNavigate = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <HeroSection
        search={search}
        onSearchChange={setSearch}
        onNavigate={handleNavigate}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
        videoSrc={heroVideoUrl}
        quickFacts={heroFacts}
      />

      <main className="flex-1 px-4 sm:px-6 lg:px-10 pb-10 space-y-6">
        <section
          id="explore"
          className="max-w-6xl mx-auto -mt-10 bg-slate-950/80 border border-slate-800 rounded-3xl shadow-[0_24px_80px_rgba(15,23,42,0.9)] backdrop-blur-xl p-4 sm:p-6"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[0.65rem] tracking-[0.3em] uppercase text-cyan-300/90 mb-2">
                Explore
              </p>
              <h2 className="text-lg sm:text-xl font-semibold">Places + Experiences layer</h2>
              <p className="text-xs sm:text-[0.8rem] text-slate-400 max-w-xl mt-1">
                Flip between destinations and the experiences that bring them to life: food runs, reggae nights, festivals and river limes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="inline-flex items-center rounded-full bg-slate-900/80 border border-slate-700/80 p-1 text-[0.68rem]">
                <button
                  type="button"
                  onClick={() => setViewMode("places")}
                  className={classNames(
                    "px-3 py-1 rounded-full flex items-center gap-1 transition",
                    viewMode === "places"
                      ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/40"
                      : "text-slate-300"
                  )}
                >
                  <MapPin className="w-3 h-3" /> Places
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("experiences")}
                  className={classNames(
                    "px-3 py-1 rounded-full flex items-center gap-1 transition",
                    viewMode === "experiences"
                      ? "bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/40"
                      : "text-slate-300"
                  )}
                >
                  <Music2 className="w-3 h-3" /> Experiences
                </button>
              </div>

              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="text-[0.7rem] rounded-full bg-slate-900/80 border border-slate-700/80 px-3 py-1 text-slate-200"
              >
                <option value="trending">Trending</option>
                <option value="rating">Top rated</option>
                <option value="priceLow">Budget friendly</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {VIBE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setVibe(option.id as Vibe)}
                  className={classNames(
                    "px-3 py-1 rounded-full border text-[0.68rem] tracking-[0.18em] uppercase",
                    vibe === option.id
                      ? "border-cyan-400 bg-cyan-400/15 text-cyan-200"
                      : "border-slate-700/80 text-slate-300/90 bg-slate-900/60"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {viewMode === "experiences" && (
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_TYPES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setExperienceType(option.id as ExperienceType)}
                    className={classNames(
                      "px-3 py-1 rounded-full border text-[0.68rem] tracking-[0.18em] uppercase",
                      experienceType === option.id
                        ? "border-emerald-400 bg-emerald-400/15 text-emerald-200"
                        : "border-slate-700/80 text-slate-300/90 bg-slate-900/60"
                    )}
                  >
                    {option.id === "food" && <Utensils className="w-3 h-3 inline-block mr-1" />}
                    {option.id === "music" && <Music2 className="w-3 h-3 inline-block mr-1" />}
                    {option.id === "festival" && <PartyPopper className="w-3 h-3 inline-block mr-1" />}
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {viewMode === "places" ? (
            <PlacesGrid
              items={filteredDestinations}
              saved={savedPlaces}
              onToggleSaved={toggleSavedPlace}
              onPlanFrom={setPlannerBaseId}
            />
          ) : (
            <ExperiencesGrid
              items={filteredExperiences}
              saved={savedExperiences}
              onToggleSaved={toggleSavedExperience}
            />
          )}

          <div className="mt-8">
            <TravelMap
              destinations={filteredDestinations}
              selectedDestinationId={plannerBaseId}
              onSelectDestination={(destinationId) => setPlannerBaseId(destinationId)}
              viewState={mapViewState}
              onMove={(event) =>
                setMapViewState({
                  latitude: event.viewState.latitude,
                  longitude: event.viewState.longitude,
                  zoom: event.viewState.zoom,
                })
              }
            />
          </div>

          <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Collaboration</p>
                <h3 className="text-base font-semibold">Share with your crew</h3>
              </div>
              {isSyncingTrip && (
                <span className="text-xs text-slate-400 animate-pulse">Syncing trip…</span>
              )}
            </div>
            {!collaborationReady && (
              <p className="text-xs text-slate-400 mt-2">
                Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable live sharing.
              </p>
            )}
            {collaborationReady && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-col gap-2">
                  <label className="text-[0.7rem] uppercase tracking-[0.2em] text-slate-500">
                    Shareable link
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      readOnly
                      value={tripShareUrl}
                      placeholder="Create a share link to collaborate"
                      className="flex-1 rounded-2xl bg-slate-950/70 border border-slate-800 px-3 py-2 text-sm text-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (tripShareUrl) {
                          navigator.clipboard.writeText(tripShareUrl);
                          setTripStatusMessage("Link copied!");
                        }
                      }}
                      disabled={!tripShareUrl}
                      className="rounded-2xl border border-slate-600 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-200 disabled:opacity-40"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                {tripStatusMessage && (
                  <p className="text-xs text-slate-400">{tripStatusMessage}</p>
                )}
              </div>
            )}
          </div>
        </section>

        <section
          id="planner"
          className="max-w-6xl mx-auto bg-slate-950/80 border border-slate-800 rounded-3xl shadow-[0_24px_80px_rgba(15,23,42,0.9)] backdrop-blur-xl p-4 sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <p className="text-[0.65rem] tracking-[0.3em] uppercase text-cyan-300/90 mb-1">
                Trip planner
              </p>
              <h2 className="text-lg sm:text-xl font-semibold">Assemble an IrieVerse loop</h2>
              <p className="text-xs sm:text-[0.8rem] text-slate-400 max-w-xl">
                Pick a base, start date, number of days, vibe and a daily budget to auto-populate a travel sketch.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {collaborationReady && (
                <button
                  type="button"
                  onClick={handleShareTrip}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/60 bg-cyan-400/10 px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50"
                  disabled={isSyncingTrip}
                >
                  {tripId ? "Update share link" : "Share trip"}
                </button>
              )}
              <button
                type="button"
                onClick={handleExportItinerary}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-400/10 px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] text-emerald-200 hover:bg-emerald-400/20"
              >
                Export itinerary (.ics)
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex flex-col gap-1 text-[0.8rem] text-slate-300">
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">Origin airport</span>
              <select
                value={originAirportId}
                onChange={(event) => handleOriginAirportChange(event.target.value)}
                className="rounded-xl bg-slate-950/80 border border-slate-700/80 px-3 py-2"
              >
                {ORIGIN_AIRPORTS.map((airport) => (
                  <option key={airport.id} value={airport.id}>
                    {airport.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-slate-300">
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
                Base destination
              </span>
              <select
                value={plannerBaseId}
                onChange={(event) => setPlannerBaseId(event.target.value)}
                className="rounded-xl bg-slate-950/80 border border-slate-700/80 px-3 py-2"
              >
                {DESTINATIONS.map((destination) => (
                  <option key={destination.id} value={destination.id}>
                    {destination.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[0.8rem] text-slate-300">
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">Days</span>
              <input
                type="number"
                min={3}
                max={14}
                value={plannerDays}
                onChange={(event) => setPlannerDays(Number(event.target.value))}
                className="rounded-xl bg-slate-950/80 border border-slate-700/80 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-[0.8rem] text-slate-300">
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">Start date</span>
              <input
                type="date"
                value={plannerStartDate}
                onChange={(event) => setPlannerStartDate(event.target.value)}
                className="rounded-xl bg-slate-950/80 border border-slate-700/80 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-[0.8rem] text-slate-300">
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">Daily vibe</span>
              <select
                value={plannerVibe}
                onChange={(event) => setPlannerVibe(event.target.value as Vibe)}
                className="rounded-xl bg-slate-950/80 border border-slate-700/80 px-3 py-2"
              >
                <option value="mixed">Mixed</option>
                {VIBE_OPTIONS.filter((option) => option.id !== "all").map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[0.8rem] text-slate-300">
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
                Budget per day (USD)
              </span>
              <input
                type="number"
                min={75}
                max={400}
                step={25}
                value={plannerBudget}
                onChange={(event) => setPlannerBudget(Number(event.target.value))}
                className="rounded-xl bg-slate-950/80 border border-slate-700/80 px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-4">
            <ItineraryView itinerary={itinerary} />
          </div>

          <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">Flight snapshot</p>
                <h3 className="text-base font-semibold">
                  {originAirport.code} → {destination?.airportCode ?? "MBJ"}
                </h3>
              </div>
              {isFetchingFlights && (
                <span className="text-xs text-slate-400 animate-pulse">Syncing gate info…</span>
              )}
            </div>
            {flightsError && (
              <p className="text-xs text-rose-300 mt-2">{flightsError}</p>
            )}
            {!flightsError && !flightOptions.length && !isFetchingFlights && (
              <p className="text-xs text-slate-400 mt-2">
                No live flights from {originAirport.code} within the snapshot window.
              </p>
            )}
            <div className="mt-3 space-y-2">
              {flightOptions.slice(0, 3).map((flight) => (
                <div
                  key={`${flight.flightNumber}-${flight.departureTimeUTC}`}
                  className="rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-3 flex flex-col gap-1 shadow shadow-slate-950/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{flight.flightNumber}</p>
                    <span className="text-[0.65rem] uppercase tracking-[0.2em] text-emerald-300">
                      {flight.status ?? "Scheduled"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {flight.airline} · {flight.origin} → {flight.destination}
                  </p>
                  <div className="text-[0.7rem] text-slate-300 flex items-center justify-between gap-3">
                    <span>{formatLocalTime(flight.departureTimeUTC, originAirport.code)} dep</span>
                    <span className="text-slate-500">▸</span>
                    <span>{formatLocalTime(flight.arrivalTimeUTC, destination?.airportCode ?? "MBJ")} arr</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <BudgetInsight
              perDay={perDayBudget}
              transportPerTrip={transportBudget}
              days={plannerDays}
              vibe={plannerVibe}
            />
          </div>

          <div className="mt-6">
            <BookingRecommendations
              bookings={bookingOptions}
              isLoading={isLoadingBookings}
              error={bookingError}
              onRefresh={loadBookings}
              destinationName={destination.name}
            />
          </div>
        </section>

        <LiveEventsFeed
          events={liveEvents}
          isLoading={isLoadingEvents}
          error={eventsError}
          onRefresh={loadEvents}
          selectedRegion={destination.region}
        />

        <ExperiencesHighlight items={EXPERIENCES.slice(0, 3)} />
      </main>

      <PageFooter />
    </div>
  );
}

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

function formatLocalTime(dateString: string, airportCode: string): string {
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

function buildShareUrl(tripId: string): string {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?trip=${encodeURIComponent(tripId)}`;
}

function updateUrlWithTrip(shareUrl: string) {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, "", shareUrl);
}
