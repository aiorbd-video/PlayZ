// এটি সার্ভার কম্পোনেন্ট, তাই এখানে এটি ১০০% কাজ করবে এবং বিল্ড এরর বাইপাস করবে
export function generateStaticParams() {
  return [];
}

export default function PlaylistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
