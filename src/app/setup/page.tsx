'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function SetupGuide() {
  const [copied, setCopied] = useState(false);
  const apiUrl = 'https://ya-machur.vercel.app/api/status?user=YOUR_NAME';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-bg-deep text-white px-6 py-12 md:py-20 flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="mb-12">
          <Link href="/" className="text-neutral-500 hover:text-white transition-colors text-sm uppercase tracking-widest font-bold mb-8 inline-block">&larr; Back to Dashboard</Link>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">Setup Guide</h1>
          <p className="text-neutral-400 text-lg">Follow these 4 steps to permanently lock in your focus protocol.</p>
        </div>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8">
            <div className="text-brand-neon font-bold tracking-widest text-sm uppercase mb-2">Step 1</div>
            <h2 className="text-2xl font-black mb-3">Install the App</h2>
            <p className="text-neutral-400">
              Ya Machur is designed as a native web application. Open this page in <strong>Safari</strong> on your iPhone, tap the <strong>Share</strong> icon at the bottom, and select <strong className="text-white">"Add to Home Screen"</strong>. This enables background persistence and the true native app experience.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8">
            <div className="text-brand-neon font-bold tracking-widest text-sm uppercase mb-2">Step 2</div>
            <h2 className="text-2xl font-black mb-4">Download the "Enforcer" Shortcut</h2>
            <p className="text-neutral-400 mb-8">
              The core of the system relies on an Apple Shortcut that aggressively intercepts when you try to open restricted apps. Download and add it to your iCloud.
            </p>
            <a href="#" className="inline-flex items-center justify-center font-black text-lg md:text-xl px-8 py-5 rounded-xl transition-all overflow-hidden bg-brand-neon text-black hover:bg-green-400 hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(57,255,20,0.2)] hover:shadow-[0_0_50px_rgba(57,255,20,0.4)] relative group w-full md:w-auto text-center border-2 border-transparent">
              <span className="relative z-10 transition-transform group-hover:scale-105 duration-300 tracking-wide">
                Download Apple Shortcut
              </span>
              <div className="absolute inset-0 h-full w-full bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
            </a>
          </div>

          {/* Step 3 */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8">
            <div className="text-brand-neon font-bold tracking-widest text-sm uppercase mb-2">Step 3</div>
            <h2 className="text-2xl font-black mb-3">Select Your Addictions</h2>
            <p className="text-neutral-400">
              When installing the Shortcut on your device, it will prompt you. Select the exact apps you want to block (e.g., <strong className="text-brand-crimson font-bold">Instagram, TikTok, Twitter</strong>). Any app selected here will be immediately locked down whenever a Pomodoro session is active.
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8">
            <div className="text-brand-neon font-bold tracking-widest text-sm uppercase mb-2">Step 4</div>
            <h2 className="text-2xl font-black mb-3">Connect Your API</h2>
            <p className="text-neutral-400 mb-6">
              Paste your unique tracking URL into the Shortcut configuration so your phone knows exactly when your timer hits zero.
            </p>
            <div className="flex flex-col md:flex-row gap-3">
              <input 
                type="text" 
                readOnly 
                value={apiUrl}
                className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-4 text-neutral-300 font-mono text-xs md:text-sm focus:outline-none"
              />
              <button 
                onClick={copyToClipboard}
                className={`px-6 py-4 rounded-xl font-bold uppercase tracking-wider text-sm transition-all shrink-0 ${
                  copied 
                  ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.3)]' 
                  : 'bg-neutral-800 text-white hover:bg-neutral-700'
                }`}
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
