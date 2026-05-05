export type SiteConfig = {
  name: string;
  description: string;
  url: string;
  author: {
    name: string;
    url: string;
  };
  links: {
    github: string;
  };
  navItems: {
    href: string;
    label: string;
    external?: boolean;
  }[];
};

export const siteConfig: SiteConfig = {
  name: "Renegade Capital",
  description:
    "Align your wealth with your values. AI-powered tools for social justice investing and ethical finance exploration.",
  url: "https://renegade-capital.hacolby.workers.dev",
  author: {
    name: "Renegade Capital",
    url: "https://github.com/jmbish04/renegade-capital",
  },
  links: {
    github: "https://github.com/jmbish04/renegade-capital",
  },
  navItems: [
    { href: "/", label: "Home" },
    { href: "/investor", label: "🏦 Investor AI" },
    { href: "/podcast", label: "🔊 Podcast Curator" },
    { href: "/clash", label: "✍️ Redlining in 2026" },
    { href: "/docs", label: "🤓 Docs", external: true },
  ],
};
