import QRCode from 'qrcode';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
  const url = `${baseUrl}/demo`;

  const buffer = await QRCode.toBuffer(url, {
    width: 600,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'inline; filename="demo-qrcode.png"',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
