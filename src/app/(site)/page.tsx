import About from "@/components/sections/About";
import CTA from "@/components/sections/CTA";
import Classes from "@/components/sections/Classes";
import { getGallery, getSchedule } from "@/lib/content";
import Coaches from "@/components/sections/Coaches";
import Contact from "@/components/sections/Contact";
import Facilities from "@/components/sections/Facilities";
import Gallery from "@/components/sections/Gallery";
import Hero from "@/components/sections/Hero";
import Marquee from "@/components/sections/Marquee";
import Membership from "@/components/sections/Membership";
import PersonalTraining from "@/components/sections/PersonalTraining";
import Stats from "@/components/sections/Stats";
import Testimonials from "@/components/sections/Testimonials";
import Why from "@/components/sections/Why";

export default async function HomePage() {
  return (
    <>
      <Hero />
      <Marquee />
      <About />
      <Stats />
      <Facilities />
      <Why />
      <Classes schedule={await getSchedule()} />
      <PersonalTraining />
      <Coaches />
      <Membership />
      <Testimonials />
      <Gallery gallery={await getGallery()} />
      <CTA />
      <Contact />
    </>
  );
}
