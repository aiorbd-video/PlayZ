import Link from "next/link";

async function getMatches() {
  const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_URL;
  // যদি ভেরিয়েবল না পায়, ডিফল্ট লিংক ব্যবহার করবে (আপনার জন্য সরাসরি বসিয়ে দিলাম সুবিধার্থে)
  const dbUrl = firebaseUrl || "https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app";
  
  try {
    const res = await fetch(`${dbUrl}/matches.json`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json() || [];
  } catch (e) {
    return [];
  }
}

export default async function Home() {
  const matches = await getMatches();
  // আপনার ইমেজ প্রক্সি লিংক
  const imgProxy = "https://img.aiorbd.workers.dev/?url=";

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
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-red-500 transition-all cursor-pointer group">
              
              <div className="flex justify-between items-center mb-4">
                {/* টিম এ (Team A) */}
                <div className="flex flex-col items-center w-1/3">
                  <img 
                    src={`${imgProxy}${match.eventInfo.teamAFlag}`} 
                    alt={match.eventInfo.teamA} 
                    className="w-14 h-14 object-contain mb-2 bg-white rounded-full p-1" 
                  />
                  <span className="text-xs text-center font-semibold">{match.eventInfo.teamA}</span>
                </div>
                
                {/* VS ব্যাজ */}
                <div className="w-1/3 text-center">
                  <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full font-bold">VS</span>
                </div>

                {/* টিম বি (Team B) */}
                <div className="flex flex-col items-center w-1/3">
                  <img 
                    src={`${imgProxy}${match.eventInfo.teamBFlag}`} 
                    alt={match.eventInfo.teamB} 
                    className="w-14 h-14 object-contain mb-2 bg-white rounded-full p-1" 
                  />
                  <span className="text-xs text-center font-semibold">{match.eventInfo.teamB}</span>
                </div>
              </div>

              <div className="text-center mb-4 border-t border-gray-700 pt-3">
                <h2 className="text-lg font-bold text-gray-100 group-hover:text-red-400 transition-colors">{match.title}</h2>
                <p className="text-xs text-gray-400 mt-1">{match.eventInfo.eventName}</p>
              </div>

              <div className="w-full bg-red-600 text-white text-center py-2 rounded-lg font-bold uppercase tracking-wider text-sm flex justify-center items-center gap-2 group-hover:bg-red-500 transition-colors">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                Watch Live
              </div>
            </div>
          </Link>
        ))}
        
        {matches.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-500">
            No live matches found right now. Check back later!
          </div>
        )}
      </div>
    </main>
  );
}
