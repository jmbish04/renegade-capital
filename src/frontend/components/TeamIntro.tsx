import React, { useState, useEffect } from 'react';

const TEAM = [
  {
    name: "Andrea Longton, CFA",
    role: "CO-HOST & PRODUCER",
    bio: "Award-winning author who recently published The Social Justice Investor, a guide for people who want to align their financial decisions with their commitments to social justice.",
    image: "https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/6f2daf95-ebe6-4a2c-8273-582a75327a92/Longton_Andrea_Photo+2000+pixels.jpg?format=500w",
    color: "text-[#a96c61]"
  },
  {
    name: "Ebony Perkins",
    role: "CO-HOST",
    bio: "Community finance executive with a solutions-oriented vision. Currently the Managing Director of Capital Strategy at a national CDFI.",
    image: "https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/460838df-c592-4a26-898f-53aeb54a654e/ebony.jpeg?format=750w",
    color: "text-[#bac48c]"
  },
  {
    name: "Leah Fremouw",
    role: "CO-HOST",
    bio: "CEO of a Community Development Financial Institution with a deep background in listening to communities for the best insights to sustainable initiatives.",
    image: "https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/a6dd99ca-64d7-4207-8eff-ca7c95d8f731/Leah+2023.jpg?format=500w",
    color: "text-primary"
  }
];

export function TeamIntro() {
  const [stage, setStage] = useState<'intro' | 'static'>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (stage === 'static') return;

    // Timer to start fading out
    const fadeOutTimer = setTimeout(() => {
      setIsFading(true);
    }, 2000); // Wait 2s, then start fading out

    // Timer to switch to next person
    const nextTimer = setTimeout(() => {
      setIsFading(false);
      if (currentIndex === TEAM.length - 1) {
        // run on repeat 2 times then go static
        if (loopCount === 2) {
          setStage('static');
        } else {
          setLoopCount(loopCount + 1);
          setCurrentIndex(0);
        }
      } else {
        setCurrentIndex(currentIndex + 1);
      }
    }, 2800); // Switch after 2.8s

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(nextTimer);
    };
  }, [currentIndex, loopCount, stage]);

  if (stage === 'static') {
    return (
      <div className="grid gap-8 md:grid-cols-3 mx-auto max-w-6xl w-full">
        {TEAM.map((member, i) => (
          <div key={i} className="group flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border transition-all hover:shadow-lg animate-in fade-in zoom-in duration-500 fill-mode-both" style={{ animationDelay: `${i * 150}ms` }}>
            <div className="relative mb-6 size-32 sm:size-40 overflow-hidden rounded-full border-4 border-background shadow-xl">
              <img src={member.image} alt={member.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
            </div>
            <h3 className="text-xl font-bold text-foreground">{member.name}</h3>
            <p className={`text-sm font-bold tracking-widest uppercase mt-1 ${member.color}`}>{member.role}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{member.bio}</p>
          </div>
        ))}
      </div>
    );
  }

  const activeMember = TEAM[currentIndex];

  // Different transitions based on index
  const getTransitionClass = () => {
    if (isFading) {
      if (currentIndex === 0) return "opacity-0 -translate-y-8 scale-95 blur-sm";
      if (currentIndex === 1) return "opacity-0 translate-x-12 scale-105 blur-sm";
      return "opacity-0 translate-y-8 rotate-3 blur-sm";
    }
    return "opacity-100 translate-x-0 translate-y-0 scale-100 rotate-0 blur-0";
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center w-full relative">
      <div className={`transition-all duration-700 ease-in-out flex flex-col items-center text-center max-w-xl mx-auto absolute ${getTransitionClass()}`}>
        <div className="relative mb-6 size-48 overflow-hidden rounded-full border-4 border-background shadow-2xl">
          <img src={activeMember.image} alt={activeMember.name} className="h-full w-full object-cover" />
        </div>
        <h3 className="text-3xl font-bold text-foreground">{activeMember.name}</h3>
        <p className={`text-sm font-bold tracking-widest uppercase mt-2 ${activeMember.color}`}>{activeMember.role}</p>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{activeMember.bio}</p>
      </div>
    </div>
  );
}
