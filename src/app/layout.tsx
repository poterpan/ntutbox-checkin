import type { Metadata, Viewport } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
	title: "NTUT 簽到系統",
	description: "北科大課程線上簽到系統",
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "NTUT 簽到",
	},
	icons: {
		icon: [
			{ url: "/icons/icon-32x32.png", sizes: "32x32", type: "image/png" },
			{ url: "/icons/icon-16x16.png", sizes: "16x16", type: "image/png" },
		],
		apple: "/apple-touch-icon.png",
	},
};

export const viewport: Viewport = {
	themeColor: "#1e40af",
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="zh-Hant">
			<head>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&display=swap" rel="stylesheet" />
			</head>
			<body>
				<SessionProvider>{children}</SessionProvider>
			</body>
		</html>
	);
}
