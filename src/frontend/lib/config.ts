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
    { href: "/agents", label: "Agents" },
    { href: "/episodes", label: "💡 Episode Ideas" },
    { href: "/guests", label: "Social Justice AI Heroes" },
    { href: "/research", label: "Research & Foundation" },
    { href: "/policy/overview", label: "🚨 Action Alert" },
    { href: "/admin/overview", label: "Admin" },
  ],
};
