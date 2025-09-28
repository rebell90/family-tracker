import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const { GET, POST } = NextAuth(authOptions)

export { GET, POST }