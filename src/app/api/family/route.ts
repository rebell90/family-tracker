import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface AuthSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    familyId?: string | null;
  }
}

// GET - Get all family members
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { family: true }
    })

    if (!user?.familyId) {
      return NextResponse.json({ members: [] })
    }

    const familyMembers = await prisma.user.findMany({
      where: { 
        familyId: user.familyId 
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      },
      orderBy: [
        { role: 'asc' }, // Parents first
        { name: 'asc' }
      ]
    })

    return NextResponse.json({ members: familyMembers })
  } catch (error) {
    console.error('Error fetching family members:', error)
    return NextResponse.json({ error: 'Failed to fetch family members' }, { status: 500 })
  }
}