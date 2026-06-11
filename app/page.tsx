import Link from "next/link";

// ফায়ারবেস থেকে ডাটা টানার ফাংশন
async function getMatches() {
  const res = await fetch("https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app/matches.json", {
    cache: "no-store" 
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data || [];
}

export default async function Home() {
  const matches = await getMatches();

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      {/* হেডার */}
      <div className="max-w-6xl mx-auto mb-8 text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-red-500 mb-2">
          Live Sports Hub
        </h1>
        <p className="text-gray-400">Watch all premium live events for free</p>
      </div>

      {/* ম্যাচ কার্ড */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {matches.map((match: any) => (
          <Link href={`/watch/${match.id}`} key={match.id}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-red-500 transition-all cursor-pointer">
              
              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col items-center w-1/3">
                  <img src={match.eventInfo.teamAFlag} alt={match.eventInfo.teamA} className="w-14 h-14 object-contain mb-2 bg-white rounded-full p-1" />
                  <span className="text-xs text-center font-semibold">{match.eventInfo.teamA}</span>
                </div>
                
                <div className="w-1/3 text-center">
                  <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full font-bold">VS</span>
                </div>

                <div className="flex flex-col items-center w-1/3">
                  <img src={match.eventInfo.teamBFlag} alt={match.eventInfo.teamB} className="w-14 h-14 object-contain mb-2 bg-white rounded-full p-1" />
                  <span className="text-xs text-center font-semibold">{match.eventInfo.teamB}</span>
                </div>
              </div>

              <div className="text-center mb-4 border-t border-gray-700 pt-3">
                <h2 className="text-lg font-bold text-gray-100">{match.title}</h2>
                <p className="text-xs text-gray-400 mt-1">{match.eventInfo.eventName}</p>
              </div>

              <div className="w-full bg-red-600 text-white text-center py-2 rounded-lg font-bold uppercase tracking-wider text-sm flex justify-center items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                Watch Live
              </div>
            </div>
          </Link>
        ))}
        
        {matches.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-500">
            No live matches found.
          </div>
        )}
      </div>
    </main>
  );
}
