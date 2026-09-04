import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/backend";
import { Card, Eyebrow, PageHeader, buttonClassName } from "@/components";
import { ProfileForm } from "./ProfileForm";
import styles from "./profile.module.css";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow muted>Account</Eyebrow>}
        title="Profile"
        subtitle="Change your sign-in email or password."
        actions={
          <Link href="/" className={buttonClassName("secondary")}>
            All campaigns
          </Link>
        }
      />

      <main className={`container section ${styles.wrap}`}>
        <div className={styles.panel}>
          <Card title="Account" description={`Signed in as ${user.email}`}>
            <ProfileForm email={user.email} />
          </Card>
        </div>
      </main>
    </>
  );
}
