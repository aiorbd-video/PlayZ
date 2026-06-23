export class QoEEngine {
  static score(data: { stall: number; buffer: number; drop: number; latency: number; rebuffer: number; }) {
    let qoe = 100;
    
    qoe -= data.stall * 10;
    
    // বাফার ১ সেকেন্ডের নিচে নামলে পেনাল্টি 
    if (data.buffer < 1) {
      qoe -= (1 - data.buffer) * 25;
    }
    
    qoe -= data.drop * 40;
    
    // ল্যাটেন্সি ১০ সেকেন্ডের বেশি হলে পেনাল্টি
    qoe -= data.latency > 10 ? (data.latency - 10) * 2 : 0;
    
    qoe -= data.rebuffer * 15;
    
    // স্কোর ০ থেকে ১০০ এর মধ্যে লক করে রাখা
    return Math.max(0, Math.min(100, qoe));
  }
}
