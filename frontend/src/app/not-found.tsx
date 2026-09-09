import Link from "next/link";
import { Card, EmptyState, Eyebrow, PageHeader, buttonClassName } from "@/components";

export default function NotFound() {
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow muted>Mail Tracker</Eyebrow>}
        title="Page not found"
        subtitle="That campaign doesn't exist, or belongs to a different account."
      />
      <main className="container section">
        <Card>
          <EmptyState
            title="Nothing here"
            description="The link you followed is broken, or the campaign has been deleted."
            action={
              <Link href="/" className={buttonClassName("primary")}>
                Back to campaigns
              </Link>
            }
          />
        </Card>
      </main>
    </>
  );
}
