import Link from "next/link";
import { getOrg } from "@/lib/org";
import { PageTitle } from "@/components/ui";

// The setup steps from spec section 4, in order. Only the first ones exist so far.
const STEPS = [
  { title: "Venues, fields and zones", href: "venues", description: "Your parks, their fields, and how each field can be split." },
  { title: "Sports, seasons and divisions", description: "Age groups and their game settings." },
  { title: "Scheduling rules", description: "Game lengths, rest gaps, blackout dates and fairness." },
  { title: "Clubs, teams and rosters", description: "Who plays in each division." },
];

export default async function OrgHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org } = await getOrg(slug);

  return (
    <main className="flex flex-col gap-6">
      <PageTitle subtitle={org.governing_body ? `Follows ${org.governing_body} rules` : undefined}>
        Set up your league
      </PageTitle>
      <ol className="flex flex-col gap-3">
        {STEPS.map((step, i) => {
          const body = (
            <>
              <p className="font-medium">
                {i + 1}. {step.title}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {step.description}
                {!step.href && " Coming soon."}
              </p>
            </>
          );
          return (
            <li key={step.title}>
              {step.href ? (
                <Link
                  href={`/o/${org.slug}/${step.href}`}
                  className="block rounded-md border border-gray-200 p-4 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-800 dark:hover:bg-blue-950"
                >
                  {body}
                </Link>
              ) : (
                <div className="rounded-md border border-dashed border-gray-200 p-4 opacity-70 dark:border-gray-800">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
