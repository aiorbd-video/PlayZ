import Link from "next/link";

async function getMatches() {
  const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_URL;
  // Fallback to a default URL if the environment variable is not set
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
  // Image proxy URL
  const imgProxy = "https://img.aiorbd.workers.dev/?url=";

  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-brand-red mb-2">
          Live Sports Hub
        </h1>
        <p className="text-gray-400">Watch all premium live events for free</p>
      </div>

      {/* Match Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {matches.map((match: any) => (
          <Link href={`/watch/${match.id}`} key={match.id}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-brand-red transition-all duration-300 ease-in-out group">
              
              <div className="flex justify-between items-center mb-4">
                {/* Team A */}
                <div className="flex flex-col items-center w-1/3">
                  <img 
                    src={`${imgProxy}${match.eventInfo.teamAFlag}`} 
                    alt={match.eventInfo.teamA} 
                    className="w-12 h-12 object-contain mb-2 bg-white rounded-full p-1" 
                  />
                  <span className="text-xs text-center font-semibold">{match.eventInfo.teamA}</span>
                </div>
                
                {/* VS Badge */}
                <div className="w-1/3 text-center">
                  <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full font-bold">VS</span>
                </div>

                {/* Team B */}
                <div className="flex flex-col items-center w-1/3">
                  <img 
                    src={`${imgProxy}${match.eventInfo.teamBFlag}`} 
                    alt={match.eventInfo.teamB} 
                    className="w-12 h-12 object-contain mb-2 bg-white rounded-full p-1" 
                  />
                  <span className="text-xs text-center font-semibold">{match.eventInfo.teamB}</span>
                </div>
              </div>

              <div className="text-center mb-4 border-t border-gray-700 pt-3">
                <h2 className="text-md font-bold text-gray-100 group-hover:text-brand-red transition-colors">{match.title}</h2>
                <p className="text-xs text-gray-400 mt-1">{match.eventInfo.eventName}</p>
              </div>

              <div className="w-full bg-brand-red text-white text-center py-2 rounded-md font-bold uppercase tracking-wider text-sm flex justify-center items-center gap-2 group-hover:bg-red-700 transition-colors">
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
