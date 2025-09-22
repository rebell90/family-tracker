import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Invite someone to family or join existing family
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, action } = await request.json() // action: 'invite' or 'join'
    
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { family: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find the user to invite/join
    const targetUser = await prisma.user.findUnique({
      where: { email },
      include: { family: true }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User with this email not found' }, { status: 404 })
    }

    if (action === 'join') {
      // Join the target user's family
      if (!targetUser.familyId) {
        return NextResponse.json({ error: 'That user is not in a family yet' }, { status: 400 })
      }

      await prisma.user.update({
        where: { id: currentUser.id },
        data: { familyId: targetUser.familyId }
      })

      return NextResponse.json({ 
        message: `Successfully joined ${targetUser.name}'s family!`,
        familyId: targetUser.familyId 
      })
    } else {
      // Invite user to current user's family
      let familyId = currentUser.familyId

      // Create family if current user doesn't have one
      if (!familyId) {
        const family = await prisma.family.create({
          data: {
            name: `${currentUser.name}'s Family`
          }
        })
        
        await prisma.user.update({
          where: { id: currentUser.id },
          data: { familyId: family.id }
        })
        
        familyId = family.id
      }

      // Add target user to family
      await prisma.user.update({
        where: { id: targetUser.id },
        data: { familyId }
      })

      return NextResponse.json({ 
        message: `Successfully invited ${targetUser.name} to your family!`,
        familyId 
      })
    }
  } catch (error) {
    console.error('Error with family invite:', error)
    return NextResponse.json({ error: 'Failed to process family invite' }, { status: 500 })
  }
}