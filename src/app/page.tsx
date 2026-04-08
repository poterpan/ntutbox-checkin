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
				<div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
					<svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<h1 className="text-2xl font-bold text-text-primary mb-2">NTUT 課堂簽到</h1>
				<p className="text-text-secondary mb-8">請用手機掃描教室投影幕上的 QR Code 完成簽到</p>

				<div className="border-t border-border pt-6">
					<p className="text-text-muted text-sm mb-3">教師與助教</p>
					<a href="/dashboard" className="btn btn-secondary">
						進入管理後台
					</a>
				</div>
			</div>
		</div>
	);
}
