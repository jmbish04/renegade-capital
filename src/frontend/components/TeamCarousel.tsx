import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const teamMembers = [
  {
    name: "Andrea Longton, CFA",
    role: "CO-HOST & PRODUCER",
    image: "https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/6f2daf95-ebe6-4a2c-8273-582a75327a92/Longton_Andrea_Photo+2000+pixels.jpg?format=500w",
    bio: "Award-winning author who recently published The Social Justice Investor, a guide for people who want to align their financial decisions with their commitments to social justice."
  },
  {
    name: "Ebony Perkins",
    role: "CO-HOST",
    image: "https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/460838df-c592-4a26-898f-53aeb54a654e/ebony.jpeg?format=750w",
    bio: "Community finance executive with a solutions-oriented vision. Currently the Managing Director of Capital Strategy at a national CDFI."
  },
  {
    name: "Leah Fremouw",
    role: "CO-HOST",
    image: "https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/a6dd99ca-64d7-4207-8eff-ca7c95d8f731/Leah+2023.jpg?format=500w",
    bio: "CEO of a Community Development Financial Institution with a deep background in listening to communities for the best insights to sustainable initiatives."
  }
];

// Define a few random animation variants
const variantsArray = [
  {
    initial: { opacity: 0, x: 100, scale: 0.9 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -100, scale: 0.9 }
  },
  {
    initial: { opacity: 0, y: 50, rotate: 5 },
    animate: { opacity: 1, y: 0, rotate: 0 },
    exit: { opacity: 0, y: -50, rotate: -5 }
  },
  {
    initial: { opacity: 0, scale: 1.2 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 }
  },
  {
    initial: { opacity: 0, y: -100 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 100 }
  }
];

export function TeamCarousel() {
  const [index, setIndex] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setVariantIndex(Math.floor(Math.random() * variantsArray.length));
      setIndex((prevIndex) => (prevIndex + 1) % teamMembers.length);
    }, 6000); // 6 seconds per slide
    return () => clearInterval(timer);
  }, []);

  const member = teamMembers[index];

  return (
    <div className="relative w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[450px] px-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          variants={variantsArray[variantIndex]}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="flex flex-col md:flex-row items-center gap-8 w-full bg-card border border-border/50 rounded-3xl p-8 shadow-sm"
        >
          {/* Image */}
          <div className="relative w-48 h-48 md:w-64 md:h-64 flex-shrink-0">
            <img
              src={member.image}
              alt={member.name}
              className="object-cover w-full h-full rounded-2xl shadow-md border border-border"
            />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10"></div>
          </div>

          {/* Text Content */}
          <div className="flex-1 text-center md:text-left">
            <p className="text-sm font-semibold tracking-wider text-[#a96c61] uppercase mb-2">
              {member.role}
            </p>
            <h3 className="text-3xl font-bold text-foreground mb-4">
              {member.name}
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {member.bio}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Pagination Dots */}
      <div className="absolute bottom-[-32px] flex justify-center gap-2">
        {teamMembers.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setVariantIndex(Math.floor(Math.random() * variantsArray.length));
              setIndex(idx);
            }}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              idx === index ? "bg-[#a96c61] w-8" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
