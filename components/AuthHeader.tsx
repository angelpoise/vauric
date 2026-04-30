"use client";

import { useUser } from "@clerk/nextjs";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default function AuthHeader() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return null;
  if (isSignedIn) return <UserButton />;
  return (
    <>
      <SignInButton />
      <SignUpButton />
    </>
  );
}
