import { currentUser } from '@clerk/nextjs/server'

export async function isAdmin(): Promise<boolean> {
  try {
    const user = await currentUser()
    const adminEmail = process.env.ADMIN_EMAIL
    return !!(user && adminEmail && user.emailAddresses.some((e) => e.emailAddress === adminEmail))
  } catch {
    return false
  }
}
