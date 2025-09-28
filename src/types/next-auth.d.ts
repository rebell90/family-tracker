declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string | null
      familyId?: string | null
    }
  }

  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string | null
    familyId?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role?: string | null
    familyId?: string | null
  }
}