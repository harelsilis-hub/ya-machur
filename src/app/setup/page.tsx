'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function SetupGuide() {
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  const apiUrl = `https://ya-machur.vercel.app/api/status?userId=${userId || 'YOUR_ACCOUNT_ID'}`;

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
            <h2 className="text-2xl font-black mb-3">Add to Home Screen</h2>
            <p className="text-neutral-400">
              Use the Safari <strong>Share</strong> icon to <strong className="text-white">"Add to Home Screen"</strong> for the full native app experience.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8">
            <div className="text-brand-neon font-bold tracking-widest text-sm uppercase mb-2">Step 2</div>
            <h2 className="text-2xl font-black mb-3">Copy Your Personal Key</h2>
            <p className="text-neutral-400 mb-6">
              Copy this now, you will need it when installing the shortcut in Step 3.
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
                {copied ? 'Copied!' : 'Copy My Key'}
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8">
            <div className="text-brand-neon font-bold tracking-widest text-sm uppercase mb-2">Step 3</div>
            <h2 className="text-2xl font-black mb-4">Install the "Enforcer" Shortcut</h2>
            <p className="text-neutral-400 mb-8">
              When prompted during installation, paste the URL you copied in Step 2 into the configuration field.
            </p>
            <a href="https://www.icloud.com/shortcuts/a018964c714645ff92f3b77777a351b0" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center font-black text-lg md:text-xl px-8 py-5 rounded-xl transition-all overflow-hidden bg-brand-neon text-black hover:bg-green-400 hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(57,255,20,0.2)] hover:shadow-[0_0_50px_rgba(57,255,20,0.4)] relative group w-full md:w-auto text-center border-2 border-transparent">
              <span className="relative z-10 transition-transform group-hover:scale-105 duration-300 tracking-wide">
                Download Shortcut
              </span>
              <div className="absolute inset-0 h-full w-full bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
            </a>
          </div>

          {/* Step 4 */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8">
            <div className="text-brand-neon font-bold tracking-widest text-sm uppercase mb-2">Step 4</div>
            <h2 className="text-2xl font-black mb-3">Activate Ninja Mode (Automation)</h2>
            <p className="text-neutral-400 mb-4">
              Open the Apple Shortcuts app, go to the <strong>Automation</strong> tab, and tap <strong>New Automation -&gt; "App"</strong>.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-neutral-400">
              <li>Select your addictive apps (Instagram, TikTok, etc.).</li>
              <li>Set to <strong className="text-white">"Run Immediately"</strong> (crucial for instant blocking).</li>
              <li>Toggle <strong className="text-white">OFF</strong> "Notify When Run" (to keep it silent).</li>
              <li>Action: Select "Run Shortcut" -&gt; "Ya Machur".</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
