import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

export const GET = (request: Request, context: { params: { nextauth: string[] } }) => 
  NextAuth(authOptions)(request, context)

export const POST = (request: Request, context: { params: { nextauth: string[] } }) => 
  NextAuth(authOptions)(request, context)