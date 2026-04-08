import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
	title: "NTUT 簽到系統",
	description: "北科大課程線上簽到系統",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="zh-Hant">
			<body>
				<SessionProvider>{children}</SessionProvider>
			</body>
		</html>
	);
}
