import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
	const session = await auth();

	if (session?.user?.email) {
		redirect("/dashboard");
	}

	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<div className="text-center max-w-md">
				<h1 className="text-3xl font-bold mb-4">NTUT 課堂簽到系統</h1>
				<p className="text-gray-500 mb-6">
					請掃描教室投影幕上的 QR Code 進行簽到
				</p>
				<a
					href="/dashboard"
					className="text-blue-600 hover:underline text-sm"
				>
					助教/教師登入
				</a>
			</div>
		</div>
	);
}
