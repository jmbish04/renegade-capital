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
    href?: string;
    label: string;
    external?: boolean;
    items?: {
      href: string;
      label: string;
      external?: boolean;
    }[];
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
    {
      label: "Agents",
      items: [
        { href: "/chat/investor", label: "Investor Agent" },
        { href: "/chat/podcast", label: "Podcast Agent" },
        { href: "/chat/policy", label: "Policy Agent" },
      ],
    },
    { href: "/episodes", label: "💡 Episode Ideas" },
    { href: "/guests", label: "Social Justice AI Heroes" },
    { href: "/research", label: "Research & Foundation" },
    {
      label: "🚨 Action Alert",
      items: [
        { href: "/policy/dashboard", label: "Policy Analytics" },
        { href: "/policy/review", label: "Document Reader" },
      ],
    },
    {
      label: "Admin",
      items: [
        { href: "/health", label: "System Health" },
        { href: "/scaler", label: "Scaler", external: true },
        { href: "/swagger", label: "Swagger", external: true },
        { href: "/openapi.json", label: "OpenAPI", external: true },
      ],
    },
  ],
};
