import type { StaticImageData } from "next/image";

/*
 * Images are imported, not referenced by path.
 *
 * A file under public/ is served at a URL that never changes, so a browser
 * that has cached it keeps showing the old picture after the file is
 * replaced - which is exactly what happened to the coach portraits. Importing
 * them makes Next fingerprint each file, so changing a photo changes its URL
 * and every visitor gets the new one.
 */
import bxSpaJacuzzi from "@/images/bx-spa-jacuzzi.jpg";
import cardioRings from "@/images/cardio-rings.jpg";
import eightyeightCafe from "@/images/eightyeight-cafe.jpg";
import feedAfterhours from "@/images/feed-afterhours.jpg";
import feedStretch from "@/images/feed-stretch.jpg";
import feedStrong from "@/images/feed-strong.jpg";
import feedTherapy from "@/images/feed-therapy.jpg";
import freeWeights from "@/images/free-weights.jpg";
import strengthZone from "@/images/strength-zone.jpg";
import studioBright from "@/images/studio-bright.jpg";
import weightsFloor from "@/images/weights-floor.jpg";
import abdelrahman from "@/images/coaches/abdelrahman.jpg";
import ahmedAyman from "@/images/coaches/ahmed-ayman.jpg";
import ahmedGomaa from "@/images/coaches/ahmed-gomaa.jpg";
import ahmedMaged from "@/images/coaches/ahmed-maged.jpg";
import dinaPhoto from "@/images/coaches/dina.jpg";
import mennaPhoto from "@/images/coaches/menna.jpg";

/**
 * Single source of truth for everything the site says about BX Fitness Hub.
 *
 * Values marked PLACEHOLDER are NOT published anywhere public yet - BX asks
 * people to DM for them. Replace the placeholder, nothing else changes.
 * Everything else is taken from the gym's own Instagram (@bx_fitnesshub) and
 * its Google Business listing.
 */

export const site = {
  name: "BX Fitness Hub",
  legalName: "BX Fitness Hub New Cairo",
  tagline: "Where Movement Meets Style.",

  phone: { display: "010 4000 1413", href: "tel:+201040001413" },
  spa: { display: "010 4000 1409", href: "tel:+201040001409" },

  // PLACEHOLDER - BX has no public email address listed anywhere.
  email: { display: "[EMAIL ADDRESS]", href: "mailto:[EMAIL ADDRESS]" },

  address: {
    line1: "2G7J+M62",
    line2: "New Cairo 1",
    region: "Cairo Governorate 4760001",
    country: "EG",
    // No street name is published anywhere; this is the landmark BX Spa
    // gives out, and it is how people actually find the place.
    street: "Right in front of Mivida",
  },
  coords: { lat: 30.0139089, lng: 31.5308549 },
  maps: "https://maps.app.goo.gl/FNZzPn2zp4Ntb3pEA",

  hours: { display: "Every day, 6:00 AM - 1:00 AM", opens: "06:00", closes: "01:00" },

  rating: { value: 4.6, count: 76 },

  social: {
    instagram: "https://www.instagram.com/bx_fitnesshub/",
    spa: "https://www.instagram.com/bx_spa/",
    cafe: "https://www.instagram.com/eightyeight.daily/",
  },

  // BX Spa runs as its own thing next door, with its own line and tagline.
  spaBrand: {
    name: "BX Spa",
    tagline: "The Art Of Stillness",
    maps: "https://maps.app.goo.gl/ghTXuENG2AHWDXmcA",
  },

  // PLACEHOLDER - swap for the real domain once it is registered.
  url: "https://bxfitnesshub.com",
} as const;

export const nav = [
  { href: "#about", label: "About" },
  { href: "#facilities", label: "Facilities" },
  { href: "#classes", label: "Classes" },
  { href: "#training", label: "Personal Training" },
  { href: "#coaches", label: "Coaches" },
  { href: "#membership", label: "Membership" },
  { href: "#gallery", label: "Gallery" },
  { href: "#contact", label: "Contact" },
] as const;

/* -------------------------------------------------------------------------
   Stats - all real except where marked.
   ---------------------------------------------------------------------- */
export const stats = [
  { value: 4.6, suffix: "", label: "Google rating", note: `${site.rating.count} reviews`, decimals: 1 },
  { value: 15, suffix: "", label: "Classes a week", note: "Members & non-members" },
  { value: 11, suffix: "", label: "Class instructors", note: "Across 12 disciplines" },
  { value: 19, suffix: "h", label: "Open every day", note: "6:00 AM - 1:00 AM" },
] as const;

/* -------------------------------------------------------------------------
   Facilities
   ---------------------------------------------------------------------- */
export const facilities = [
  {
    title: "Strength Floor",
    copy: "Racks, platforms and plate-loaded machines under the ring lights, with mirrors on every wall.",
    image: weightsFloor,
    alt: "The BX strength floor at night, lit by ring pendants and warm cove lighting",
  },
  {
    title: "Cardio Deck",
    copy: "A full row of Life Fitness cardio facing the illuminated BX monogram.",
    image: cardioRings,
    alt: "Row of cross-trainers beneath circular LED pendants and the lit BX logo",
  },
  {
    title: "Free Weights",
    copy: "Dumbbells to the far wall, benches, bars and bands - under the PUSH YOUR LIMITS sign.",
    image: freeWeights,
    alt: "Barbell rack and dumbbell wall lit by angular LED frames",
  },
  {
    title: "Movement Studio",
    copy: "Pale oak, floor-to-ceiling mirrors and daylight. Pilates, yoga, stretching and dance.",
    image: studioBright,
    alt: "Bright mirrored movement studio with pale oak flooring",
  },
  {
    title: "EightyEight",
    copy: "The coffee shop on site. Salads, protein and proper coffee, straight after a session.",
    image: eightyeightCafe,
    alt: "The EightyEight counter at BX, under its lit sign and shelves of supplements",
  },
  {
    title: "BX Spa",
    copy: "Recovery next door. Jacuzzi, hammam, sauna and massage - the art of stillness.",
    image: bxSpaJacuzzi,
    alt: "The jacuzzi at BX Spa, beside a living green wall and a stone water feature",
  },
] as const;

/* -------------------------------------------------------------------------
   Why BX
   ---------------------------------------------------------------------- */
export const reasons = [
  {
    kicker: "01",
    title: "Built for performance",
    copy: "Every corner is made to move. The floor is laid out so nothing queues and nothing crowds.",
  },
  {
    kicker: "02",
    title: "Open when you are",
    copy: "Six in the morning until one at night, seven days a week. Train after hours - where limits move.",
  },
  {
    kicker: "03",
    title: "Coaches, not supervisors",
    copy: "Eleven coaches across strength, boxing, pilates, yoga, dance and recovery. All on the floor.",
  },
  {
    kicker: "04",
    title: "Classes open to everyone",
    copy: "Members and non-members both book the timetable, with ladies-only sessions every week.",
  },
  {
    kicker: "05",
    title: "More than a gym floor",
    copy: "BX Spa for recovery, EightyEight for food, physiotherapy and InBody testing in-house.",
  },
  {
    kicker: "06",
    title: "A room you want to be in",
    copy: "Warm light, dark stone, oak and glass. It is a nice place to spend an hour of your day.",
  },
] as const;

/* -------------------------------------------------------------------------
   Class timetable - transcribed from the September 2026 schedule card
   published on @bx_fitnesshub. "Open for members & non-members."
   ---------------------------------------------------------------------- */
export type Session = {
  time: string;
  coach: string;
  discipline: string;
  ladiesOnly?: boolean;
};

export const schedule: { day: string; short: string; sessions: Session[] }[] = [
  {
    day: "Saturday",
    short: "Sat",
    sessions: [
      { time: "2:00 PM", coach: "Nourhan Kamal", discipline: "Mobility & Flexibility" },
      { time: "6:00 PM", coach: "Farah", discipline: "60 Min Stronger" },
      { time: "7:00 PM", coach: "Esraa", discipline: "Oriental Flow", ladiesOnly: true },
    ],
  },
  {
    day: "Sunday",
    short: "Sun",
    sessions: [
      { time: "7:00 PM", coach: "Kero", discipline: "Boxing" },
      { time: "8:30 PM", coach: "Nour Sheshtawy", discipline: "Zumba", ladiesOnly: true },
      { time: "9:30 PM", coach: "Farida Hosny", discipline: "Active Recovery Yoga" },
    ],
  },
  {
    day: "Monday",
    short: "Mon",
    sessions: [
      { time: "7:00 PM", coach: "Diana", discipline: "Mat Pilates" },
      { time: "8:00 PM", coach: "Diana", discipline: "Yoga & Meditation" },
    ],
  },
  {
    day: "Tuesday",
    short: "Tue",
    sessions: [
      { time: "6:00 PM", coach: "Ahmed Gomaa", discipline: "Core" },
      { time: "7:00 PM", coach: "Sarah Elshobokshy", discipline: "Afro Dance", ladiesOnly: true },
      { time: "9:00 PM", coach: "Farida Hosny", discipline: "Stress Relief" },
    ],
  },
  {
    day: "Wednesday",
    short: "Wed",
    sessions: [
      { time: "7:00 PM", coach: "Yassmin Alaadin", discipline: "Pilates" },
      { time: "8:00 PM", coach: "Yassmin Alaadin", discipline: "Stretching" },
      { time: "9:00 PM", coach: "Didos", discipline: "Indoor Cycling" },
    ],
  },
  {
    day: "Thursday",
    short: "Thu",
    sessions: [{ time: "7:00 PM", coach: "Kero", discipline: "Boxing" }],
  },
  { day: "Friday", short: "Fri", sessions: [] },
];

/* Disciplines pulled from the timetable and the gym's own class posts. */
export const disciplines = [
  { name: "Boxing", note: "Punch. Sweat. Repeat.", intensity: "High" },
  { name: "60 Min Stronger", note: "Full-body strength circuit", intensity: "High" },
  { name: "Indoor Cycling", note: "Ride to the rhythm", intensity: "High" },
  { name: "Core", note: "Midline under tension", intensity: "Moderate" },
  { name: "Mat Pilates", note: "Control and precision", intensity: "Moderate" },
  { name: "Afro Dance", note: "Move. Groove. Glow.", intensity: "Moderate" },
  { name: "Zumba", note: "Dance-led cardio", intensity: "Moderate" },
  { name: "Oriental Flow", note: "Rhythm and control", intensity: "Moderate" },
  { name: "Mobility & Flexibility", note: "Open the hinges", intensity: "Low" },
  { name: "Stretching", note: "Stretch your limits", intensity: "Low" },
  { name: "Yoga & Meditation", note: "Strong body, clear mind", intensity: "Low" },
  { name: "Active Recovery Yoga", note: "Breathe. Stretch. Reset.", intensity: "Low" },
] as const;

/* -------------------------------------------------------------------------
   Coaches - BX's personal training team, exactly as presented in the
   "Coaches" highlight on @bx_fitnesshub: names, certifying body and the
   specialisations each one lists. Portraits are from the same cards.

   Class instructors are a separate, larger group and are credited against
   their own sessions in the timetable above.
   ---------------------------------------------------------------------- */
export type Coach = {
  name: string;
  credential: string;
  disciplines: string[];
  photo: StaticImageData;
};

export const coaches: Coach[] = [
  {
    name: "Ahmed Ayman",
    credential: "Certified Personal Trainer (NASM)",
    disciplines: [
      "Hypertrophy Training",
      "Physique Transformation",
      "Athletic Performance",
    ],
    photo: ahmedAyman,
  },
  {
    name: "Ahmed Maged",
    credential: "Certified Personal Trainer (NASM)",
    disciplines: ["Bodybuilding & Fat Loss"],
    photo: ahmedMaged,
  },
  {
    name: "Abdelrahman",
    credential: "Certified Personal Trainer",
    disciplines: ["Hypertrophy Training", "Physique Transformation"],
    photo: abdelrahman,
  },
  {
    name: "Ahmed Gomaa",
    credential: "Certified Personal Trainer (ACE)",
    disciplines: ["Movement & Strength Improvement", "Exercise for Stress Management"],
    photo: ahmedGomaa,
  },
  {
    name: "Dina",
    credential: "Certified Personal Trainer (EREPS)",
    disciplines: ["Posture Correction", "Senior Fitness"],
    photo: dinaPhoto,
  },
  {
    name: "Menna",
    credential: "Certified Personal Trainer",
    disciplines: ["Athletic Performance", "Strength & Conditioning"],
    photo: mennaPhoto,
  },
];

/* -------------------------------------------------------------------------
   Membership - the perk lists are exactly as published by BX.
   Prices are NOT published anywhere; BX asks people to DM. Replace the
   PLACEHOLDER strings below with the real figures.
   ---------------------------------------------------------------------- */
export const plans = [
  {
    name: "Monthly",
    price: "[MONTHLY PRICE]",
    period: "per month",
    blurb: "Full access, no commitment.",
    perks: [
      "Full gym and studio access",
      "All classes, members' rate",
      "Locker room access",
      "1 InBody test",
    ],
    featured: false,
  },
  {
    name: "1 Year",
    price: "[ANNUAL PRICE]",
    period: "per year",
    blurb: "The one most members take.",
    perks: [
      "2 months freeze",
      "15 guest invitations",
      "1 assessment session",
      "2 personal training sessions",
      "10 InBody tests",
      "1 nutrition session",
    ],
    featured: true,
  },
  {
    name: "Couples & Friends",
    price: "[COUPLES PRICE]",
    period: "per year, each",
    blurb: "Annual membership - share the journey.",
    perks: [
      "2 months freeze each",
      "15 guest invitations each",
      "1 assessment session each",
      "Everything in the 1 Year plan",
    ],
    featured: false,
  },
] as const;

/* -------------------------------------------------------------------------
   Testimonials - PLACEHOLDER. BX holds 4.6 from 76 Google reviews, but the
   individual review text has not been cleared for use. Replace the three
   quotes below with real, attributed reviews before launch.
   ---------------------------------------------------------------------- */
export const testimonials = [
  { quote: "[MEMBER QUOTE 1]", name: "[MEMBER NAME]", detail: "[MEMBER SINCE]" },
  { quote: "[MEMBER QUOTE 2]", name: "[MEMBER NAME]", detail: "[MEMBER SINCE]" },
  { quote: "[MEMBER QUOTE 3]", name: "[MEMBER NAME]", detail: "[MEMBER SINCE]" },
] as const;

/* Gallery - real frames from the gym and its campaigns. */
export const gallery = [
  { src: cardioRings, alt: "Cardio deck under ring pendants with the lit BX monogram", ratio: "tall" },
  { src: feedAfterhours, alt: "Barbell rack on the free-weights floor after hours", ratio: "square" },
  { src: studioBright, alt: "Mirrored movement studio in daylight", ratio: "tall" },
  { src: weightsFloor, alt: "Strength floor with benches, cable machine and warm cove lighting", ratio: "tall" },
  { src: feedTherapy, alt: "Therapy session on the mat in the recovery studio", ratio: "square" },
  { src: strengthZone, alt: "Cable machines beside the windows over New Cairo", ratio: "tall" },
  { src: feedStrong, alt: "Mobility work with blocks in the movement studio", ratio: "square" },
  { src: feedStretch, alt: "Stretch session in the studio under violet light", ratio: "square" },
] as const;
