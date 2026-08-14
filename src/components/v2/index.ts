/**
 * Shared shell components for the v2 (warm earthy) redesign.
 *
 * Usage in a v2 page:
 *   import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
 *
 *   <>
 *     <AuroraBackground />
 *     <NavRail />
 *     <BottomNav />
 *     <main className="app-shell">
 *       <UserBar streakDays={10} xp={820} xpTarget={1000} avatarLetter="Y" isPro />
 *       <Breadcrumb items={[{ label: "Sensei", href: "/" }, { label: "Beranda" }]} />
 *       ...
 *     </main>
 *   </>
 *
 * Foundation is opt-in — v1 pages remain on the existing blue layout
 * until they're migrated.
 */
export { AuroraBackground } from "./AuroraBackground";
export { NavRail } from "./NavRail";
export { BottomNav } from "./BottomNav";
export { UserBar } from "./UserBar";
export { Breadcrumb } from "./Breadcrumb";
