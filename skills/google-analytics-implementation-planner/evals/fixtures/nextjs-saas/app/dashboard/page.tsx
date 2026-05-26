import Link from "next/link";

const features = [
  { id: "reports", name: "Reports" },
  { id: "imports", name: "Imports" },
  { id: "alerts", name: "Alerts" },
];

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <nav aria-label="Primary">
        {features.map((feature) => (
          <Link key={feature.id} href={`/features/${feature.id}`}>
            {feature.name}
          </Link>
        ))}
      </nav>
    </main>
  );
}
