import { auth } from "@clerk/nextjs/server";
import LandingHero from "@/components/LandingHero";
import WorkflowDashboard from "@/components/WorkflowDashboard";
import AppHeader from "@/components/AppHeader";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return <LandingHero />;
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#05070b]">
      <AppHeader />
      <WorkflowDashboard />
    </main>
  );
}
