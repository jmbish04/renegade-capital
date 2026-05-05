import { Hono } from "hono";

export const clashRouter = new Hono();

export const clashData = {
  pdfUrl: "https://drive.google.com/file/d/1tItjO_kVpZY-WtUWUN9w0xsF0q4qCWvW/preview",
  pillars: [
    {
      id: "bias",
      title: "The Fight Over Bias and Inclusion",
      goal: "Fight against racist, sexist, and exclusive financial norms.",
      trumpPlan: "Revises NIST framework to eliminate references to DEI and requires AI to be free from 'social engineering agendas.'",
      guests: [
        { 
          name: "Ruha Benjamin", 
          role: "Originator of 'New Jim Code'", 
          impact: "Exposes how neutral algorithms act as a 'New Jim Code' that deepens racial hierarchies.",
          animationConfig: { delay: "0s", duration: "6s", yOffset: "-15px" }
        },
        { 
          name: "Safiya Umoja Noble", 
          role: "Digital Archivist", 
          impact: "Proves commercial search engines reinforce racism and sexism.",
          animationConfig: { delay: "2s", duration: "7s", yOffset: "20px" }
        }
      ]
    },
    {
      id: "environment",
      title: "Environmental Impact vs 'Build, Baby, Build'",
      goal: "Protect the health of communities through environmental justice and green finance.",
      trumpPlan: "Bypasses environmental protections (Clean Air/Water Acts, NEPA) to rapidly build data centers and grids.",
      guests: [
        { 
          name: "Kate Crawford", 
          role: "Systems Thinker", 
          impact: "Calls out environmental devastation from lithium mining to data centers.",
          animationConfig: { delay: "1s", duration: "8s", yOffset: "-20px" }
        },
        { 
          name: "Christoph Nedopil", 
          role: "Global Economist", 
          impact: "Directs trillions in capital toward the green transition to avert climate catastrophe.",
          animationConfig: { delay: "3s", duration: "6s", yOffset: "15px" }
        }
      ]
    },
    {
      id: "regulation",
      title: "Financial Regulation vs. The 'Digital Poorhouse'",
      goal: "Advocate for higher ethical standards in financial institutions and close the wealth gap.",
      trumpPlan: "Removes red tape and FTC/SEC regulations to accelerate AI dominance through 'regulatory sandboxes'.",
      guests: [
        { 
          name: "Virginia Eubanks", 
          role: "Investigative Storyteller", 
          impact: "Documents how automated welfare and risk systems create a 'digital poorhouse'.",
          animationConfig: { delay: "0.5s", duration: "7s", yOffset: "-10px" }
        },
        { 
          name: "Cathy O'Neil", 
          role: "Data Scientist", 
          impact: "Exposes how unregulated big data models increase inequality and act as weapons of math destruction.",
          animationConfig: { delay: "2.5s", duration: "6.5s", yOffset: "25px" }
        }
      ]
    }
  ]
};

clashRouter.get("/", (c) => {
  return c.json(clashData);
});
