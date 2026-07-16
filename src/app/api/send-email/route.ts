import { NextRequest, NextResponse } from 'next/server'

// POST /api/send-email
// Sends email via Resend API with optional Excel attachment (base64)
export async function POST(req: NextRequest) {
  try {
    const { to, subject, html, attachmentBase64, attachmentName } = await req.json()

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'to, subject, and html are required' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        error: 'RESEND_API_KEY not configured',
        message: 'Add RESEND_API_KEY to your environment variables.',
      }, { status: 503 })
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const fromName = process.env.RESEND_FROM_NAME || 'Nokhaba Payroll'

    const emailBody: any = {
      from: `${fromName} <${fromEmail}>`,
      to: to.split(',').map((e: string) => e.trim()),
      subject,
      html,
    }

    // Add attachment if provided (base64 encoded Excel file)
    if (attachmentBase64) {
      emailBody.attachments = [{
        filename: attachmentName || 'payroll_report.xlsx',
        content: attachmentBase64,
      }]
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    })

    const result = await response.json()

    if (response.ok) {
      return NextResponse.json({
        success: true,
        messageId: result.id,
        message: 'Email sent successfully',
      })
    } else {
      return NextResponse.json({
        error: 'Resend API error',
        message: result.message || result.error || 'Unknown error',
        details: result,
      }, { status: response.status })
    }
  } catch (e: any) {
    console.error('Email send failed:', e)
    return NextResponse.json({
      error: 'Email send failed',
      message: e.message,
    }, { status: 500 })
  }
}
