export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Norish",
  description: "Nourish every meal.",
  navItems: [
    {
      key: "home",
      label: "Home",
      href: "/",
    },
    {
      key: "groceries",
      label: "Groceries",
      href: "/groceries",
    },
    {
      key: "calendar",
      label: "Calendar",
      href: "/calendar",
    },
  ],
  navMenuItems: [
    {
      label: "Profile",
      href: "/profile",
    },
  ],
  links: {
    github: "https://github.com/mikevanes/norish",
  },
};
