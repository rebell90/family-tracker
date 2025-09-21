import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('Registration attempt started') // Debug log
    
    const body = await request.json()
    console.log('Request body:', body) // Debug log
    
    const { name, email, password, role } = body

    // Validate required fields
    if (!name || !email || !password || !role) {
      console.log('Missing required fields') // Debug log
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    console.log('Checking for existing user...') // Debug log
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      console.log('User already exists') // Debug log
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    console.log('Hashing password...') // Debug log
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    console.log('Creating user...') // Debug log
    
    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      }
    })

    console.log('User created:', user.id) // Debug log
    console.log('Creating user points...') // Debug log

    // Create initial UserPoints record
    await prisma.userPoints.create({
      data: {
        userId: user.id,
        currentPoints: 0,
        totalEarned: 0,
      }
    })

    console.log('Registration completed successfully') // Debug log

    return NextResponse.json(
      { message: 'User created successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error) // This should show us the real error
    
    // Return a proper JSON error response
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}