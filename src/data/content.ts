import { Destination, Experience } from "../types/travel";

export const DESTINATIONS: Destination[] = [
  {
    id: "mobay",
    name: "Montego Bay",
    region: "North Coast",
    vibes: ["chill", "nightlife", "family"],
    rating: 4.7,
    priceLevel: 3,
    headline: "Beaches, golf courses, and the Hip Strip nightlife.",
    description:
      "Resort central with Doctor's Cave Beach, lively Hip Strip bars, and nearby rafting on the Great River.",
    highlights: [
      "Doctor's Cave Beach swim + sunset",
      "Hip Strip bar hopping & live music",
      "Catamaran cruise with snorkelling",
      "Great River bamboo rafting",
      "Open-air jerk and rum punch",
    ],
    heroImage:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Doctors-Cave-Beach.jpg?width=1200",
    placeLookup: {
      query: "Doctor's Cave Beach, Montego Bay, Jamaica",
      requiredTerms: ["doctor", "cave"],
      blockedTerms: ["imaging", "diagnostic", "medical", "clinic", "radiology"],
    },
    latitude: 18.4762,
    longitude: -77.8939,
    airportCode: "MBJ",
    quickFacts: [
      { label: "Best season", value: "Dec – Apr (dry season)" },
      { label: "From NYC", value: "~3.5 hr flight" },
      { label: "Current vibes", value: "29°C · light breeze" },
    ],
  },
  {
    id: "negril",
    name: "Negril",
    region: "West Coast",
    vibes: ["chill", "romantic", "adventure"],
    rating: 4.9,
    priceLevel: 3,
    headline: "Seven Mile Beach by day, cliffside sunsets by night.",
    description:
      "Laid-back, romantic, and scenic with long beaches, cliff diving, and chilled bars.",
    highlights: [
      "Seven Mile Beach beach day",
      "Cliff jumping (or watching) at Rick's",
      "Glass-bottom boat ride",
      "Sunset cocktails on the cliffs",
      "Late-night reggae on the sand",
    ],
    heroImage:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Atlantic_ocean_negril_jamaica.jpg?width=1200",
    placeLookup: {
      query: "Seven Mile Beach, Negril, Jamaica",
      requiredTerms: ["seven", "mile"],
    },
    latitude: 18.2728,
    longitude: -78.3488,
    airportCode: "MBJ",
    quickFacts: [
      { label: "Best season", value: "Nov – Mar" },
      { label: "From MIA", value: "~1.5 hr flight" },
      { label: "Sunset", value: "6:05 PM over cliffs" },
    ],
  },
  {
    id: "ochi",
    name: "Ocho Rios",
    region: "North Coast",
    vibes: ["adventure", "family", "chill"],
    rating: 4.8,
    priceLevel: 3,
    headline: "Waterfalls, rivers, and cruise-port buzz.",
    description:
      "Iconic Dunn's River Falls, Blue Hole, river tubing, and a mix of cruise energy and local flavour.",
    highlights: [
      "Dunn's River Falls climb",
      "Blue Hole river swim",
      "White River rafting or tubing",
      "Local patties and street food",
      "Duty-free shopping by the pier",
    ],
    heroImage:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Ocho_R%C3%ADos-Jamaica03.JPG?width=1200",
    placeLookup: {
      query: "Dunn's River Falls, Ocho Rios, Jamaica",
      requiredTerms: ["dunn", "river"],
    },
    latitude: 18.4029,
    longitude: -76.974,
    airportCode: "KIN",
    quickFacts: [
      { label: "Best season", value: "Dec – Apr" },
      { label: "Cruise days", value: "Tue · Thu" },
      { label: "River temp", value: "19°C at dawn" },
    ],
  },
  {
    id: "kingston",
    name: "Kingston",
    region: "South-East",
    vibes: ["culture", "nightlife"],
    rating: 4.5,
    priceLevel: 2,
    headline: "Sound systems, street art, and city energy.",
    description:
      "The capital city with the Bob Marley Museum, galleries, street food, and serious dancehall nights.",
    highlights: [
      "Bob Marley Museum tour",
      "Devon House ice cream & courtyard",
      "Downtown murals & waterfront stroll",
      "Dub club or rooftop reggae session",
      "Street food crawl at night",
    ],
    heroImage:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Kingston%2C_Jamaica.JPG?width=1200",
    placeLookup: {
      query: "Bob Marley Museum, Kingston, Jamaica",
      requiredTerms: ["bob", "marley"],
    },
    latitude: 17.9784,
    longitude: -76.7882,
    airportCode: "KIN",
    quickFacts: [
      { label: "Best season", value: "Year-round" },
      { label: "From ATL", value: "~2.5 hr flight" },
      { label: "Nightlife", value: "Fri/Sat uptown" },
    ],
  },
  {
    id: "portland",
    name: "Port Antonio & Portland",
    region: "East",
    vibes: ["chill", "adventure", "nature"],
    rating: 4.9,
    priceLevel: 2,
    headline: "Lush, quiet, and cinematic coastlines.",
    description:
      "Blue Lagoon, Frenchman's Cove, Rio Grande rafting, and some of the island's greenest scenery.",
    highlights: [
      "Blue Lagoon swim (or boat)",
      "Frenchman's Cove beach day",
      "Rio Grande bamboo rafting",
      "Boston Bay jerk chicken & pork",
      "Hidden coves and local beaches",
    ],
    heroImage:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Frenchman%27s_Cove_%2832306710322%29.jpg?width=1200",
    placeLookup: {
      query: "Frenchman's Cove, Portland, Jamaica",
      requiredTerms: ["frenchman", "cove"],
    },
    latitude: 18.1801,
    longitude: -76.457,
    airportCode: "KIN",
    quickFacts: [
      { label: "Best season", value: "Dec – Jun" },
      { label: "Rain chance", value: "40% afternoons" },
      { label: "Sea temp", value: "27°C" },
    ],
  },
  {
    id: "southcoast",
    name: "South Coast",
    region: "South-West",
    vibes: ["chill", "authentic"],
    rating: 4.6,
    priceLevel: 2,
    headline: "Laid-back fishing villages and sandbars.",
    description:
      "Less touristy stretch with Treasure Beach, Pelican Bar, YS Falls, and crocodile safaris.",
    highlights: [
      "Boat ride to Pelican Bar sandbar",
      "YS Falls river swim",
      "Black River safari",
      "Treasure Beach chill day",
      "Seafood at a seaside cookshop",
    ],
    heroImage:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Treasure_Beach_Jamaica_2023.jpg?width=1200",
    placeLookup: {
      query: "Treasure Beach, St Elizabeth, Jamaica",
      requiredTerms: ["treasure", "beach"],
    },
    latitude: 17.8815,
    longitude: -77.7675,
    airportCode: "MBJ",
    quickFacts: [
      { label: "Best season", value: "Jan – May" },
      { label: "Closest airport", value: "MBJ · 2 hr" },
      { label: "Water temp", value: "26°C" },
    ],
  },
];

export const EXPERIENCES: Experience[] = [
  {
    id: "boston-bay-jerk-trail",
    title: "Boston Bay Jerk Trail",
    type: "food",
    region: "Portland",
    location: "Boston Bay",
    linkedDestinationId: "portland",
    vibes: ["chill", "food"],
    rating: 4.9,
    energy: "mellow",
    description:
      "Sample legendary jerk stands where many say jerk was born. Smoke, spice, and sea breeze.",
    whatToExpect: [
      "Walk between several jerk stalls",
      "Order chicken, pork, and festival",
      "Chat with pit masters and locals",
    ],
    bestTime: "Lunch to sunset",
    imageUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Boston_beach_Jamaica_-_panoramio.jpg?width=1200",
    approxCost: "$",
    placeLookup: {
      query: "Boston Jerk Centre, Portland, Jamaica",
      requiredTerms: ["boston", "jerk"],
    },
  },
  {
    id: "kingston-sound-system-night",
    title: "Kingston Sound System Night",
    type: "music",
    region: "Kingston",
    location: "Various yards & streets",
    linkedDestinationId: "kingston",
    vibes: ["nightlife", "culture"],
    rating: 4.8,
    energy: "high",
    description:
      "A proper sound system session with heavy bass, selectors, and street food.",
    whatToExpect: [
      "Local crowd, real dancehall energy",
      "Street vendors serving jerk & soup",
      "Music until very late",
    ],
    bestTime: "Late night, mainly weekends",
    imageUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Street_dance_Kingston_Jamaica_passa_passa.jpg?width=1200",
    approxCost: "$$",
  },
  {
    id: "negril-sunset-reggae-cruise",
    title: "Negril Sunset Reggae Cruise",
    type: "music",
    region: "Negril",
    location: "Off Seven Mile Beach",
    linkedDestinationId: "negril",
    vibes: ["chill", "romantic"],
    rating: 4.7,
    energy: "medium",
    description:
      "Catamaran cruise with live or curated reggae, open bar, and cliffside sunset views.",
    whatToExpect: [
      "Snorkelling stop",
      "Onboard drinks and snacks",
      "Sunset near the cliffs",
    ],
    bestTime: "Golden hour",
    imageUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Negril_sunset.jpg?width=1200",
    approxCost: "$$$",
  },
  {
    id: "mobay-street-food-night",
    title: "Mobay Street Food Night Run",
    type: "food",
    region: "Montego Bay",
    location: "City & Hip Strip",
    linkedDestinationId: "mobay",
    vibes: ["nightlife", "food"],
    rating: 4.6,
    energy: "medium",
    description:
      "Guided (or self-guided) hop between patty shops, pan chicken, and late-night cookshops.",
    whatToExpect: [
      "Mix of locals and visitors",
      "Short taxi rides between stops",
      "Plenty of pepper sauce",
    ],
    bestTime: "Evening into night",
    imageUrl:
      "https://images.unsplash.com/photo-1658833621083-01fd8a4acf19?auto=format&fit=crop&w=1200&q=80",
    approxCost: "$$",
    placeLookup: {
      query: "The Pork Pit, Montego Bay, Jamaica",
      requiredTerms: ["pork", "pit"],
    },
  },
  {
    id: "maroon-festival-winchesters",
    title: "Maroon Heritage Celebration",
    type: "festival",
    region: "Cockpit Country",
    location: "Maroon community (e.g., Accompong)",
    linkedDestinationId: "southcoast",
    vibes: ["culture", "heritage"],
    rating: 4.8,
    energy: "high",
    description:
      "Annual celebration of Maroon history with drumming, food, and ceremonies.",
    whatToExpect: [
      "Processions and traditional music",
      "Local food stalls",
      "Crowds and a full-day experience",
    ],
    bestTime: "Specific dates each year",
    imageUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Accompong_Maroon_Festival_IMG_6766.jpg?width=1200",
    approxCost: "$$",
    placeLookup: {
      query: "Accompong Maroon Village, St Elizabeth, Jamaica",
      requiredTerms: ["accompong"],
    },
  },
  {
    id: "ochi-river-lemons-and-lime",
    title: "River Lime by the Falls",
    type: "festival",
    region: "Ocho Rios",
    location: "River spots near Ochi",
    linkedDestinationId: "ochi",
    vibes: ["chill", "adventure"],
    rating: 4.7,
    energy: "medium",
    description:
      "Day party by the river with floats, sound system, and jerk pans.",
    whatToExpect: [
      "River swimming",
      "Coolers and tents",
      "Loud music, big vibes",
    ],
    bestTime: "Weekends and holidays",
    imageUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Jamaica_Ocho_Rios_Dunn%27s_River_Falls_2.jpg?width=1200",
    approxCost: "$$",
    placeLookup: {
      query: "Dunn's River Falls, Ocho Rios, Jamaica",
      requiredTerms: ["dunn", "river"],
    },
  },
];

export const VIBE_OPTIONS = [
  { id: "all", label: "All vibes" },
  { id: "chill", label: "Chill" },
  { id: "adventure", label: "Adventure" },
  { id: "culture", label: "Culture" },
  { id: "nightlife", label: "Nightlife" },
];

export const EXPERIENCE_TYPES = [
  { id: "all", label: "All types" },
  { id: "food", label: "Food" },
  { id: "music", label: "Music" },
  { id: "festival", label: "Festivals" },
];
