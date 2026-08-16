// Purely decorative right-side panel for the login page. Extracted verbatim
// from LoginPage so that file stays under the project's 300-line split
// threshold -- no props, no logic, just the static marketing markup.
export function LoginHero() {
  return (
    <aside className="relative hidden h-screen w-1/2 flex-col overflow-hidden md:flex" style={{ background: 'var(--gradient-header)' }}>
      <div className="absolute -left-40 -top-40 h-[500px] w-[500px] animate-pulse rounded-full bg-[#005f73]/25 blur-[120px]" style={{ animationDuration: '4s' }} />
      <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] animate-pulse rounded-full bg-brand/10 blur-[120px]" style={{ animationDuration: '5s', animationDelay: '1s' }} />
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite] rounded-full bg-gradient-to-r from-transparent via-[#005f73]/10 to-transparent blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.2]"
        style={{ backgroundImage: `radial-gradient(circle at center, #ffffff 1px, transparent 1px)`, backgroundSize: '24px 24px' }}
      />
      <style>{`
        @keyframes float-slow { 0%, 100% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(0, -20px) rotate(3deg); } }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float-slow 7s ease-in-out infinite 2s; }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes comet { 0% { opacity: 0; transform: translate(0,0); } 5% { opacity: 0.75; } 100% { opacity: 0; transform: translate(-520px, 520px); } }
        @keyframes card-spot { 0%, 33%, 100% { border-color: rgba(255,255,255,0.08); box-shadow: none; } 8%, 25% { border-color: rgba(163,230,53,0.28); box-shadow: 0 0 22px rgba(163,230,53,0.09), inset 0 0 0 1px rgba(163,230,53,0.12); } }
        .spot-1 { animation: card-spot 12s ease-in-out 0s infinite; }
        .spot-2 { animation: card-spot 12s ease-in-out 4s infinite; }
        .spot-3 { animation: card-spot 12s ease-in-out 8s infinite; }
      `}</style>

      {/* Rotating gem */}
      <div className="absolute bottom-1/3 left-10 animate-float-delayed">
        <div style={{ animation: 'spin-slow 28s linear infinite' }}>
          <svg width="58" height="58" viewBox="0 0 58 58" fill="none" aria-hidden="true">
            <polygon points="29,2 54,15.5 54,42.5 29,56 4,42.5 4,15.5" stroke="rgba(163,230,53,0.28)" strokeWidth="1" fill="rgba(163,230,53,0.07)" />
            <polygon points="29,12 44,20.5 44,37.5 29,46 14,37.5 14,20.5" stroke="rgba(163,230,53,0.15)" strokeWidth="0.75" fill="rgba(163,230,53,0.04)" />
            <circle cx="29" cy="29" r="3" fill="rgba(163,230,53,0.45)" />
          </svg>
        </div>
      </div>

      {/* Shooting star comets */}
      {([
        { top: '4%',  right: '8%',  delay: '0s',   dur: '2.4s', w: 65 },
        { top: '10%', right: '35%', delay: '2.1s',  dur: '1.9s', w: 45 },
        { top: '2%',  right: '18%', delay: '4.5s',  dur: '2.2s', w: 72 },
        { top: '16%', right: '5%',  delay: '1.3s',  dur: '2.6s', w: 52 },
        { top: '7%',  right: '52%', delay: '6s',    dur: '2s',   w: 58 },
        { top: '1%',  right: '42%', delay: '3.2s',  dur: '1.8s', w: 40 },
        { top: '20%', right: '22%', delay: '5.4s',  dur: '2.3s', w: 48 },
      ] as { top: string; right: string; delay: string; dur: string; w: number }[]).map((c, i) => (
        <div
          key={i}
          className="pointer-events-none absolute"
          style={{ top: c.top, right: c.right, animation: `comet ${c.dur} ease-in ${c.delay} infinite` }}
        >
          <div style={{ width: `${c.w}px`, height: '1px', background: 'linear-gradient(to right, rgba(255,255,255,0.55), rgba(255,255,255,0))', transform: 'rotate(-45deg)', transformOrigin: 'right center' }} />
        </div>
      ))}
      <div className="relative z-10 flex h-full flex-col justify-between p-8 lg:p-12">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(163,230,53,0.8)', animation: 'pulse 2.4s ease-in-out 0s infinite' }} />
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(163,230,53,0.45)', animation: 'pulse 2.4s ease-in-out 0.8s infinite' }} />
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(163,230,53,0.18)', animation: 'pulse 2.4s ease-in-out 1.6s infinite' }} />
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
        </div>
        <div className="max-w-xl">
          <div className="mb-4 inline-flex transform items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 lg:px-4 lg:py-2 transition-all hover:-translate-y-1 hover:bg-brand/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand"></span>
            </span>
            <span className="text-2xs lg:text-xs font-semibold uppercase tracking-widest text-brand">Next-Gen Platform</span>
          </div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
            Elevate your <br />
            <span className="bg-gradient-to-r from-brand via-brand-hover to-brand-dark bg-clip-text text-transparent">stone operations.</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm lg:text-base leading-relaxed text-white/60">
            Experience seamless workflow management, real-time material tracking, and unmatched clarity across your entire fabrication process.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:mt-8">
            <div className="spot-1 group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-3 lg:p-4 backdrop-blur-sm transition-colors duration-500 hover:bg-white/10">
              <div className="mb-2 inline-flex rounded-lg bg-brand/20 p-1.5 text-brand transition-transform group-hover:scale-110 group-hover:bg-brand/30">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-xs font-semibold text-white">Smart Workflows</h3>
              <p className="mt-1 text-label leading-relaxed text-white/40">Automate tasks and streamline coordination.</p>
            </div>
            <div className="spot-2 group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-3 lg:p-4 backdrop-blur-sm transition-colors duration-500 hover:bg-white/10">
              <div className="mb-2 inline-flex rounded-lg bg-brand/20 p-1.5 text-brand transition-transform group-hover:scale-110 group-hover:bg-brand/30">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <h3 className="text-xs font-semibold text-white">Ironclad Security</h3>
              <p className="mt-1 text-label leading-relaxed text-white/40">Enterprise-grade protection for your data.</p>
            </div>
            <div className="spot-3 group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-3 lg:p-4 backdrop-blur-sm transition-colors duration-500 hover:bg-white/10">
              <div className="mb-2 inline-flex rounded-lg bg-brand/20 p-1.5 text-brand transition-transform group-hover:scale-110 group-hover:bg-brand/30">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              </div>
              <h3 className="text-xs font-semibold text-white">Material Tracking</h3>
              <p className="mt-1 text-label leading-relaxed text-white/40">Real-time slab and inventory visibility.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-4 lg:pt-6">
          <p className="text-2xs lg:text-xs font-medium uppercase tracking-widest text-white/30">© {new Date().getFullYear()} Stone Suite</p>
          <div className="flex items-center gap-2 lg:gap-3">
            <span className="flex h-7 w-7 lg:h-8 lg:w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white">
              <svg className="size-3 lg:size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
            </span>
            <span className="flex h-7 w-7 lg:h-8 lg:w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white">
              <svg className="size-3 lg:size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
