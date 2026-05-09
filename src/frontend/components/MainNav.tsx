import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

export function MainNav({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="Main navigation"
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {siteConfig.navItems.map((item) => {
        if (item.items) {
          return (
            <div key={item.label} className="group relative">
              <button
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                })}
              >
                {item.label}
              </button>
              <div className="absolute left-0 top-full hidden w-48 flex-col rounded-md border bg-popover p-1 text-popover-foreground shadow-md group-hover:flex">
                {item.items.map((subItem) => {
                  const isExternal = subItem.external;
                  return (
                    <a
                      key={subItem.href}
                      href={subItem.href}
                      {...(isExternal
                        ? {
                            target: "_blank",
                            rel: "noopener noreferrer",
                          }
                        : {})}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      {subItem.label}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        }

        const isExternal = item.external;
        return (
          <a
            key={item.href || item.label}
            href={item.href}
            {...(isExternal
              ? {
                  target: "_blank",
                  rel: "noopener noreferrer",
                }
              : {})}
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
            })}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
