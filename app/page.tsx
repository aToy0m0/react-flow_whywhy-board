import Link from "next/link";

export default function HomePage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">WhyWhy Board</h1>
      <p className="mb-4">ボード画面へ移動：</p>
      <ul className="list-disc list-inside">
        <li>
          <Link className="text-blue-600 underline" href="/boards/dev">/boards/dev</Link>
        </li>
      </ul>
    </main>
  );
}

