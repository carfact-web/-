import Link from "next/link";
export default function WebtoonAdminNotFound() {
 return <main className="mx-auto max-w-lg space-y-4 p-8"><h1 className="text-xl font-bold">관리자 권한이 필요합니다.</h1><p>관리자 계정으로 로그인한 뒤 관리자 메뉴의 웹툰 관리로 접속해주세요.</p><Link href="/admin" className="underline">관리자 메뉴로 이동</Link></main>;
}
