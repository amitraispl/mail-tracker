import { buttonClassName } from "@/components";

/** Plain form post, so sign-out works without any client JS. */
export function SignOutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button type="submit" className={buttonClassName("secondary")}>
        Sign out
      </button>
    </form>
  );
}

export default SignOutButton;
